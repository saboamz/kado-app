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
  // Ticked, not typed — free text lives in "À propos" above.
  await page.getByText('Gourmandise', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  /*
   * toHaveURL, not waitForURL.
   *
   * waitForURL waits for a load state as well as the address, and the page it
   * is waiting on has already arrived — the assertion hung while the URL read
   * /profile the whole time. Polling the address is what this actually wants,
   * and the taller form below made the race reproducible rather than rare.
   */
  await expect(page).toHaveURL(/\/profile$/, { timeout: 15_000 });
  // The name now also appears in the desktop nav, so target the heading.
  await expect(
    page.getByRole('heading', { name: 'Nom Modifié' }),
  ).toBeVisible();
  await expect(page.getByText('J’aime le café filtre.')).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: /^Gourmandise$/ }),
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

test('light is what you get back when you leave the dark theme', async ({
  page,
}) => {
  /*
   * There used to be a third option, "Comme mon appareil", and the app
   * followed prefers-color-scheme. It no longer does: light is the default
   * and dark is a decision, so that option produced exactly the same screen
   * as "Clair" while promising something else.
   */
  await signIn(page, scenario.ownerEmail);
  await page.goto('/settings');

  await page.getByRole('radio', { name: 'Sombre' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vos préférences ont été enregistrées.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('radio', { name: 'Clair' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vos préférences ont été enregistrées.')).toBeVisible();

  await page.goto('/app');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
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

test('a password can be changed, and the old one stops working', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/settings');

  const next = `${TEST_PASSWORD}-changed`;
  await page.getByLabel('Mot de passe actuel').fill(TEST_PASSWORD);
  await page.getByLabel('Nouveau mot de passe').fill(next);
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();

  /*
   * Generous, because this request does scrypt twice — once to check the
   * current password and once to make the new hash — at N=2^17, about a
   * second of deliberate work before the transaction even starts.
   */
  await expect(page.getByText(/Mot de passe changé/)).toBeVisible({ timeout: 30_000 });

  // The session doing the changing survives it — otherwise the person is
  // signed out of the tab they just typed in.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app$/);

  // The old password is refused, the new one is not.
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');

  // The old password is refused: still on /login, and nothing was signed in.
  await page.getByLabel('Adresse e-mail').fill(scenario.ownerEmail);
  await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/\/login$/);

  // The new one is not. Both fields again — the refused submit re-rendered
  // the form and the address does not necessarily survive that round trip.
  await page.getByLabel('Adresse e-mail').fill(scenario.ownerEmail);
  await page.getByLabel('Mot de passe').fill(next);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
});

test('changing a password refuses a wrong current one', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto('/settings');

  await page.getByLabel('Mot de passe actuel').fill('not-the-password');
  await page.getByLabel('Nouveau mot de passe').fill('a-brand-new-one');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();

  await expect(page.locator('#current-error')).toBeVisible({ timeout: 15_000 });
});
