import { expect, test, type Page } from '@playwright/test';

async function signOut(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');
}

/**
 * Opens Sophie's Anniversaire list from a friend's home feed.
 *
 * The feed renders one card per list, labelled "Owner · List", so there is no
 * intermediate profile step to click through.
 */
async function openSophiesBirthdayList(page: Page) {
  await page
    .getByRole('link')
    .filter({ hasText: 'Sophie Marchand · Anniversaire' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/lists\/[a-z0-9]+$/);
  await expect(page.getByRole('heading', { name: 'Anniversaire' })).toBeVisible();
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('kado1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

/**
 * The promise the whole product rests on, exercised through the interface:
 * a friend reserves, and the owner learns nothing.
 */
test('a reservation is invisible to the owner', async ({ page }) => {
  // Emma reserves the vase on Sophie's list.
  await signIn(page, 'emma@kado.app');
  await page.goto('/app');
  await openSophiesBirthdayList(page);
  const listUrl = page.url();

  await page.getByText('Vase en grès émaillé').click();
  await page.getByRole('button', { name: 'Je réserve ce cadeau' }).click();

  await expect(
    page.getByRole('button', { name: 'Annuler ma réservation' }),
  ).toBeVisible();
  const giftUrl = page.url();

  // The friend sees their own reservation on the list.
  await page.goto(listUrl);
  await expect(page.getByText('Réservé par vous')).toBeVisible();
  await expect(page.getByText(/déjà réservée/)).toBeVisible();

  // Sophie, the owner, sees none of it.
  await signOut(page);
  await signIn(page, 'sophie@kado.app');
  await page.goto(listUrl);

  await expect(page.getByRole('heading', { name: 'Anniversaire' })).toBeVisible();
  await expect(page.getByText('Réservé par vous')).toHaveCount(0);
  await expect(page.getByText('Déjà réservé')).toHaveCount(0);
  await expect(page.getByText(/déjà réservée/)).toHaveCount(0);

  // Not on the gift's own page either — and no reserve control exists for her.
  await page.goto(giftUrl);
  await expect(page.getByRole('button', { name: /réserve/i })).toHaveCount(0);
  await expect(
    page.getByText(/aucune information de réservation n'existe/),
  ).toBeVisible();

  // Clean up: Emma releases it so the seed is left as found.
  await signOut(page);
  await signIn(page, 'emma@kado.app');
  await page.goto(giftUrl);
  await page.getByRole('button', { name: 'Annuler ma réservation' }).click();
  await expect(
    page.getByRole('button', { name: 'Je réserve ce cadeau' }),
  ).toBeVisible();
});

test('another friend sees a gift is taken but not by whom', async ({ page }) => {
  // Thomas reserved the AirPods in the seed.
  await signIn(page, 'emma@kado.app');
  await page.goto('/app');
  await openSophiesBirthdayList(page);

  await page.getByText('AirPods Pro 3').click();
  await expect(
    page.getByRole('button', { name: 'Déjà réservé par un proche' }),
  ).toBeDisabled();
  await expect(page.getByText(/Vous ne saurez pas qui/)).toBeVisible();

  // Thomas's name appears nowhere on the page.
  await expect(page.getByText('Thomas')).toHaveCount(0);
});

test('the owner cannot reserve from their own list', async ({ page }) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/lists');
  await page.getByText('Anniversaire').first().click();
  await page.getByText('Vase en grès émaillé').click();

  await expect(page.getByRole('button', { name: /réserve/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Modifier' })).toBeVisible();
});

test('releasing frees the gift for someone else', async ({ page }) => {
  await signIn(page, 'emma@kado.app');
  await page.goto('/app');
  await openSophiesBirthdayList(page);
  await page.getByText('Sac de randonnée 30 L').click();
  const giftUrl = page.url();

  await page.getByRole('button', { name: 'Je réserve ce cadeau' }).click();
  await expect(
    page.getByRole('button', { name: 'Annuler ma réservation' }),
  ).toBeVisible();

  // Lucas sees it taken.
  await signOut(page);
  await signIn(page, 'lucas@kado.app');
  await page.goto(giftUrl);
  await expect(
    page.getByRole('button', { name: 'Déjà réservé par un proche' }),
  ).toBeDisabled();

  // Emma releases it; Lucas can now take it.
  await signOut(page);
  await signIn(page, 'emma@kado.app');
  await page.goto(giftUrl);
  await page.getByRole('button', { name: 'Annuler ma réservation' }).click();
  await expect(
    page.getByRole('button', { name: 'Je réserve ce cadeau' }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, 'lucas@kado.app');
  await page.goto(giftUrl);
  await expect(
    page.getByRole('button', { name: 'Je réserve ce cadeau' }),
  ).toBeVisible();
});
