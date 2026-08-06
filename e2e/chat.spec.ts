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

test('friends coordinate in the secret chat', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  await expect(page.getByRole('region', { name: 'Discussion secrète' })).toBeVisible();
  await expect(page.getByText('Aucun message')).toBeVisible();

  await page.getByLabel('Votre message').fill('Je peux mettre 50 €.');
  await page.getByRole('button', { name: 'Envoyer' }).click();

  await expect(page.getByText('Je peux mettre 50 €.')).toBeVisible();
  await expect(page.getByText('Vous').first()).toBeVisible();

  // The other friend reads it and replies.
  await signOut(page);
  await signIn(page, scenario.otherFriendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  await expect(page.getByText('Je peux mettre 50 €.')).toBeVisible();
  await page.getByLabel('Votre message').fill('Je complète le reste.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Je complète le reste.')).toBeVisible();
});

/** The chat spells the surprise out in words, so this is the sharpest test. */
test('the owner sees no chat and none of its contents', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);
  await page.getByLabel('Votre message').fill('On lui offre ça ensemble.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('On lui offre ça ensemble.')).toBeVisible();

  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  // No room, and no hint that a room exists.
  await expect(
    page.getByRole('region', { name: 'Discussion secrète' }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Votre message')).toHaveCount(0);

  // And not a word of what was said.
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('On lui offre ça ensemble.');
  expect(body).not.toContain('Discussion secrète');
});

test('an author can delete their own message but not another’s', async ({
  page,
}) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);
  await page.getByLabel('Votre message').fill('À supprimer.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('À supprimer.')).toBeVisible();

  // The other friend sees it, without a delete control.
  await signOut(page);
  await signIn(page, scenario.otherFriendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);
  await expect(page.getByText('À supprimer.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Supprimer' })).toHaveCount(0);

  // The author removes it.
  await signOut(page);
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('À supprimer.')).toHaveCount(0);
});

test('an empty message is not sent', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  // The button stays disabled until there is something to say.
  await expect(page.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  await page.getByLabel('Votre message').fill('   ');
  await expect(page.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
});

test('the chat is available on ordinary gifts too', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);

  // Coordination is not only for pots: two people may still want to agree.
  await expect(page.getByRole('region', { name: 'Discussion secrète' })).toBeVisible();
});
