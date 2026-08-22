import { expect, test } from '@playwright/test';

const DEMO = { email: 'sophie@kadlio.app', password: 'kadlio1234' };

test('the landing page pitches the product and offers both entry points', async ({
  page,
}) => {
  await page.goto('/');
  /*
   * Asserted on what a stranger needs, not on one sentence.
   *
   * The old check pinned the headline verbatim, so rewriting the copy broke
   * it — and the copy is the part most likely to change again. What must not
   * disappear is a visitor being told WHAT this is and being shown the app,
   * which is exactly what the page was missing before.
   */
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  /*
   * Scoped to the paragraph, not to the page.
   *
   * The <title> now carries the same phrase — that is the point of it, since
   * it is what somebody types — so an unscoped match finds two elements and
   * Playwright refuses the ambiguity. What this line is about is the visitor
   * being TOLD what Kadlio is, which is the paragraph.
   */
  await expect(
    page.locator('p').filter({ hasText: /liste de cadeaux en ligne/i }),
  ).toBeVisible();
  // The two views of one gift: the demo that says what prose could not.
  await expect(page.getByText(/Aucune information de réservation/i)).toBeVisible();
  await expect(page.getByText(/Déjà réservé par un proche/i)).toBeVisible();

  await expect(page.getByRole('link', { name: 'Créer mon compte' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible();
});

test('a signed-out visitor cannot reach the app', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
});

test('signing in with the demo account reaches the app', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(DEMO.email);
  await page.getByLabel('Mot de passe').fill(DEMO.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: /Sophie/ })).toBeVisible();
});

test('a wrong password is refused without revealing whether the account exists', async ({
  page,
}) => {
  // Scoped to the form: Next injects its own role="alert" route announcer.
  const error = page.locator('form p[role="alert"]');
  const message = 'E-mail ou mot de passe incorrect.';

  // A registered address with the wrong password.
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(DEMO.email);
  await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(error).toHaveText(message);
  await expect(page).toHaveURL(/\/login$/);

  // An address with no account at all. Reloaded rather than resubmitted, so
  // this asserts on a fresh response instead of the previous error still
  // being on screen.
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('personne@kadlio.app');
  await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(error).toHaveText(message);
  await expect(page).toHaveURL(/\/login$/);
});

test('signing up creates an account with a default list', async ({ page }) => {
  const email = `nouveau-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Nom').fill('Nouvelle Personne');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  // A new account lands on the questionnaire, not the app. Skipping is a link.
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('link', { name: 'Passer cette étape' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Mes envies')).toBeVisible();
});

test('the sign-up questionnaire saves what is ticked, and skips cleanly', async ({
  page,
}) => {
  const email = `enquete-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Nom').fill('Personne Curieuse');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  await page.getByText('Café', { exact: true }).click();
  await page.getByText('Randonnée', { exact: true }).click();
  await page.getByText('Une femme', { exact: true }).click();
  await page.getByText('25 – 34', { exact: true }).click();

  await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });

  // Stored, and editable afterwards — which is what the privacy policy
  // promises about withdrawing consent.
  await page.goto('/profile/edit');
  await expect(page.getByLabel(/Centres d'intérêt/)).toHaveValue(/Café/);
  await expect(page.getByLabel('Vous êtes…')).toHaveValue('FEMALE');
  await expect(page.getByLabel('Votre tranche d’âge')).toHaveValue('AGE_25_34');
});

test('not answering the questionnaire stores nothing', async ({ page }) => {
  const email = `muet-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Nom').fill('Personne Discrète');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  // Submitting untouched: every question defaults to "rather not say", which
  // is stored as an absence rather than as a category.
  await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });

  await page.goto('/profile/edit');
  await expect(page.getByLabel('Vous êtes…')).toHaveValue('');
  await expect(page.getByLabel('Votre tranche d’âge')).toHaveValue('');
});

test('signing up rejects a password under eight characters', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Nom').fill('Test');
  await page.getByLabel('Adresse e-mail').fill(`court-${Date.now()}@example.com`);
  await page.getByLabel('Mot de passe').fill('court');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  // The hint also says "8 caractères", so assert on the error element itself.
  await expect(page.locator('#password-error')).toHaveText(/8 caractères/);
  await expect(page).toHaveURL(/\/signup$/);
});

test('signing out ends the session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(DEMO.email);
  await page.getByLabel('Mot de passe').fill(DEMO.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Signing out lives on the profile, where account actions belong.
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
});
