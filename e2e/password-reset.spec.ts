import { expect, test, type Page } from '@playwright/test';
import {
  clearResetAttempts,
  createResetToken,
  createScenario,
  destroyScenario,
  disconnect,
  TEST_PASSWORD,
  type Scenario,
} from './fixtures';

/*
 * The e-mailed half of a password change, driven end to end — minus the
 * e-mail itself: the server has no RESEND_API_KEY here, so the send is a
 * logged no-op, and the specs mint their own token through the fixture
 * (the database only ever holds the hash, so a token cannot be read out).
 */

let scenario: Scenario;

test.beforeEach(async () => {
  scenario = await createScenario();
});

test.afterEach(async () => {
  await destroyScenario(scenario);
  await clearResetAttempts();
});

test.afterAll(async () => {
  await disconnect();
});

async function signIn(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('the request form answers the same for known and unknown addresses', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await page.waitForURL('**/forgot-password');

  await page.getByLabel('Adresse e-mail').fill(scenario.ownerEmail);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  await expect(page.getByText(/Si un compte existe/)).toBeVisible();

  // An address with no account gets the identical sentence: this page must
  // not say which addresses are registered.
  await page.goto('/forgot-password');
  await page.getByLabel('Adresse e-mail').fill('personne@example.com');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  await expect(page.getByText(/Si un compte existe/)).toBeVisible();
});

test('a minted link sets a new password, ends old sessions, signs in', async ({
  page,
  context,
}) => {
  // An open session on another "device", to be killed by the reset.
  await signIn(page, scenario.ownerEmail);
  await page.waitForURL('**/app');
  const oldCookies = await context.cookies();
  await context.clearCookies();

  const token = await createResetToken(scenario.ownerEmail);
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('Nouveau mot de passe').fill('nouveau-mdp-123');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await page.waitForURL('**/app');

  // The pre-reset session is dead.
  await context.clearCookies();
  await context.addCookies(oldCookies);
  await page.goto('/app');
  await page.waitForURL('**/login');

  // The old password is refused, the new one works.
  await signIn(page, scenario.ownerEmail, TEST_PASSWORD);
  await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
  await signIn(page, scenario.ownerEmail, 'nouveau-mdp-123');
  await page.waitForURL('**/app');
});

test('a spent or invented link fails with a way to ask again', async ({ page }) => {
  const token = await createResetToken(scenario.ownerEmail);
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('Nouveau mot de passe').fill('nouveau-mdp-123');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await page.waitForURL('**/app');

  // The same link, resubmitted.
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('Nouveau mot de passe').fill('encore-un-autre-123');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByText('Ce lien ne fonctionne plus.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demander un nouveau lien' })).toBeVisible();

  // A guessed token never reaches the form at all.
  await page.goto('/reset-password?token=invente');
  await page.getByLabel('Nouveau mot de passe').fill('peu-importe-123');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByText('Ce lien ne fonctionne plus.')).toBeVisible();
});
