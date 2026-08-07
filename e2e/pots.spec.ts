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

test('a friend contributes and the total rises', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  await expect(page.getByRole('heading', { name: 'Cagnotte' })).toBeVisible();
  await expect(page.getByText(/Personne n’a encore participé/)).toBeVisible();

  await page.getByRole('button', { name: '50 €' }).click();
  await page.getByRole('button', { name: 'Participer' }).click();

  await expect(page.getByText(/Votre part/)).toBeVisible();
  await expect(page.getByText(/1 personne participe/)).toBeVisible();
  await expect(page.getByText(/il reste/)).toBeVisible();
});

test('two friends see the shared total but not each other', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);
  await page.getByRole('button', { name: '100 €' }).click();
  await page.getByRole('button', { name: 'Participer' }).click();
  await expect(page.getByText(/Votre part/)).toBeVisible();

  await signOut(page);
  await signIn(page, scenario.otherFriendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  // The second friend sees the pooled total and the headcount…
  await expect(page.getByText(/1 personne participe/)).toBeVisible();
  // …but has contributed nothing themselves, and no name is shown.
  await expect(page.getByText(/Votre part/)).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Ami ');
});

test('the owner sees no pot at all', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);
  await page.getByRole('button', { name: '100 €' }).click();
  await page.getByRole('button', { name: 'Participer' }).click();
  await expect(page.getByText(/Votre part/)).toBeVisible();

  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  await expect(page.getByRole('heading', { name: 'Cagnotte' })).toHaveCount(0);
  await expect(page.getByText(/réunis sur/)).toHaveCount(0);
  await expect(page.getByText(/participe/)).toHaveCount(0);
  await expect(
    page.getByText(/aucune information de réservation n'existe/),
  ).toBeVisible();
});

test('a contribution can be withdrawn', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  await page.getByRole('button', { name: '20 €' }).click();
  await page.getByRole('button', { name: 'Participer' }).click();
  await expect(page.getByText(/Votre part/)).toBeVisible();

  await page.getByRole('button', { name: 'Retirer ma participation' }).click();
  await expect(page.getByText(/Votre part/)).toHaveCount(0);
  await expect(page.getByText(/Personne n’a encore participé/)).toBeVisible();
});

test('a contribution cannot overshoot the target', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  // The target is 500 €; overpaying would need a manual refund.
  await page.getByLabel('Montant de votre participation').fill('900');
  await page.getByRole('button', { name: 'Participer' }).click();

  await expect(page.locator('section p[role="alert"]')).toContainText(
    /il ne reste que/i,
  );
});

test('the owner cannot contribute to their own pot', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  await expect(page.getByRole('button', { name: 'Participer' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Modifier' })).toBeVisible();
});

test('an already-open gift is joined, not reserved', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.potGiftId}`);

  // Somebody else holds this one and opened it. There is nothing left to
  // reserve — the way in is the pot.
  await expect(page.getByRole('button', { name: /réserve/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cagnotte' })).toBeVisible();
});

test('a friend reserves a gift, then opens it to the others', async ({
  page,
}) => {
  // The decision the owner used to make when they added the wish, now taken
  // by the person who actually knows the price and who else is interested.
  await signIn(page, scenario.friendEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);

  await page.getByRole('button', { name: 'Je réserve ce cadeau' }).click();
  await expect(
    page.getByRole('button', { name: /Inviter d.autres à participer/ }),
  ).toBeVisible();
  // Not a pot yet: reserving alone is still the default.
  await expect(page.getByRole('heading', { name: 'Cagnotte' })).toHaveCount(0);

  await page
    .getByRole('button', { name: /Inviter d.autres à participer/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Cagnotte' })).toBeVisible();

  // And the owner still sees none of it.
  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);
  await expect(page.getByRole('heading', { name: 'Cagnotte' })).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Cadeau à plusieurs');
});
