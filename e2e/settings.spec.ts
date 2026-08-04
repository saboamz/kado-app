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

test('the profile can be edited and the changes show on the profile page', async ({
  page,
}) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/profile/edit');

  await page.getByLabel('Nom').fill('Nom Modifié');
  await page.getByLabel('À propos').fill('J’aime le café filtre.');
  await page.getByLabel("Centres d'intérêt").fill('Café, céramique');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.waitForURL('**/profile');
  await expect(page.getByText('Nom Modifié')).toBeVisible();
  await expect(page.getByText('J’aime le café filtre.')).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: /^Café$/ }),
  ).toBeVisible();
});

test('a profile without a name is refused', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/profile/edit');

  await page.getByLabel('Nom').fill('');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Renseignez votre nom.')).toBeVisible();
  // Still on the form, nothing saved.
  await expect(page).toHaveURL(/\/profile\/edit$/);
});

test('choosing the dark theme applies it and it survives a reload', async ({
  page,
}) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/settings');

  await page.getByRole('radio', { name: 'Sombre' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vos préférences ont été enregistrées.')).toBeVisible();

  // The attribute is set server-side from the session, so a fresh navigation
  // renders dark without a flash of the light theme first.
  await page.goto('/app');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the system theme leaves the choice to the device', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/settings');

  await page.getByRole('radio', { name: 'Comme mon appareil' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vos préférences ont été enregistrées.')).toBeVisible();

  // No attribute at all, so the prefers-color-scheme media query applies.
  await page.goto('/app');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
});

test('the currency preference is remembered', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/settings');

  await page.getByLabel('Devise').selectOption('GBP');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vos préférences ont été enregistrées.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Devise')).toHaveValue('GBP');
});

test('deleting an account signs the person out and frees what they reserved', async ({
  page,
}) => {
  await signIn(page, scenario.friendEmail);

  // The friend holds a reservation on the owner's gift.
  await page.goto(`/gifts/${scenario.freeGiftId}`);
  await page.getByRole('button', { name: 'Je réserve ce cadeau' }).click();
  await expect(
    page.getByRole('button', { name: 'Annuler ma réservation' }),
  ).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await page.waitForURL(/\/$|\/login/);

  // The session is gone.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);

  // And the gift is available again for somebody else.
  await signIn(page, scenario.otherFriendEmail);
  await page.goto(`/gifts/${scenario.freeGiftId}`);
  await expect(
    page.getByRole('button', { name: 'Je réserve ce cadeau' }),
  ).toBeVisible();
});
