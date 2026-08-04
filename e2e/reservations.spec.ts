import { expect, test, type Page } from '@playwright/test';
import {
  createScenario,
  destroyScenario,
  disconnect,
  TEST_PASSWORD,
  type Scenario,
} from './fixtures';

/**
 * Each spec builds its own owner, friends, list and gifts, then removes them.
 *
 * Reserving gifts from the seed coupled these tests to its exact state: one
 * aborted run left a reservation behind and the next failed for reasons that
 * had nothing to do with reservations.
 */
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

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

async function signOut(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');
}

/** The promise the product rests on, exercised through the interface. */
test('a reservation is invisible to the owner', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);

  await page.getByRole('button', { name: 'Je réserve ce cadeau' }).click();
  await expect(
    page.getByRole('button', { name: 'Annuler ma réservation' }),
  ).toBeVisible();

  // The friend sees their own reservation on the list.
  await page.goto(`/lists/${scenario.listId}`);
  await expect(page.getByText('Réservé par vous')).toBeVisible();
  await expect(page.getByText(/déjà réservées/)).toBeVisible();

  // The owner sees none of it.
  await signOut(page);
  await signIn(page, scenario.ownerEmail);

  await page.goto(`/lists/${scenario.listId}`);
  await expect(page.getByText('Réservé par vous')).toHaveCount(0);
  await expect(page.getByText('Déjà réservé')).toHaveCount(0);
  await expect(page.getByText(/réservée/)).toHaveCount(0);

  // Nor on the gift itself, where no reserve control exists for them at all.
  await page.goto(`/gifts/${scenario.freeGiftId}`);
  await expect(page.getByRole('button', { name: /réserve/i })).toHaveCount(0);
  await expect(
    page.getByText(/aucune information de réservation n'existe/),
  ).toBeVisible();
});

test('another friend sees a gift is taken but never by whom', async ({
  page,
}) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.takenGiftId}`);

  await expect(
    page.getByRole('button', { name: 'Déjà réservé par un proche' }),
  ).toBeDisabled();
  await expect(page.getByText(/Vous ne saurez pas qui/)).toBeVisible();

  // The holder's name appears nowhere on the page.
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Autre ');
});

test('the owner cannot reserve from their own list', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);

  await expect(page.getByRole('button', { name: /réserve/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Modifier' })).toBeVisible();
});

test('releasing frees the gift for someone else', async ({ page }) => {
  const giftUrl = `/gifts/${scenario.freeGiftId}`;

  await signIn(page, scenario.friendEmail);
  await page.goto(giftUrl);
  await page.getByRole('button', { name: 'Je réserve ce cadeau' }).click();
  await expect(
    page.getByRole('button', { name: 'Annuler ma réservation' }),
  ).toBeVisible();

  // The other friend now finds it taken.
  await signOut(page);
  await signIn(page, scenario.otherFriendEmail);
  await page.goto(giftUrl);
  await expect(
    page.getByRole('button', { name: 'Déjà réservé par un proche' }),
  ).toBeDisabled();

  // Released, it becomes available to them.
  await signOut(page);
  await signIn(page, scenario.friendEmail);
  await page.goto(giftUrl);
  await page.getByRole('button', { name: 'Annuler ma réservation' }).click();
  await expect(
    page.getByRole('button', { name: 'Je réserve ce cadeau' }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, scenario.otherFriendEmail);
  await page.goto(giftUrl);
  await expect(
    page.getByRole('button', { name: 'Je réserve ce cadeau' }),
  ).toBeVisible();
});

test('a stranger cannot reserve from a list they cannot see', async ({
  page,
}) => {
  // A second scenario's owner is a stranger to the first scenario's list.
  const outsider = await createScenario();
  try {
    await signIn(page, outsider.ownerEmail);
    await page.goto(`/gifts/${scenario.freeGiftId}`);
    await expect(page.getByText('404')).toBeVisible();
  } finally {
    await destroyScenario(outsider);
  }
});
