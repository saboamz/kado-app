import { expect, test, type Page } from '@playwright/test';
import { TEST_PASSWORD } from './fixtures';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

test('the events page lists what friends published, soonest first', async ({
  page,
}) => {
  // The seed publishes Thomas at 24 days and Emma at 45.
  await signIn(page, 'sophie@kado.app');
  await page.goto('/events');

  await expect(page.getByRole('heading', { name: 'À venir' })).toBeVisible();
  await expect(page.getByText('Dans le mois')).toBeVisible();
  await expect(page.getByText('Thomas Bel')).toBeVisible();

  // The label is the owner's own word for the date, not a category.
  await expect(page.getByText('Anniversaire').first()).toBeVisible();

  // The nearest event is listed before the more distant ones.
  const names = await page.locator('a[href^="/u/"]').allInnerTexts();
  expect(names[0]).toContain('Thomas');
});

test('a date can be published and then removed', async ({ page }) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/profile/edit');

  const label = `Test ${Date.now()}`;
  await page.getByLabel('Intitulé').fill(label);
  await page.getByLabel('Jour').selectOption('4');
  await page.getByRole('button', { name: 'Ajouter une date' }).click();

  await expect(page.getByText(label)).toBeVisible();

  // Scoped to the row that carries the new label, so it cannot remove another.
  const row = page.locator('li').filter({ hasText: label });
  await row.getByRole('button', { name: 'Retirer' }).click();

  // Wait for the row itself to go, not for the text: the assertion used to
  // race the revalidation and read the label still on screen. Waiting on the
  // element that the action removes is the signal that it landed.
  await expect(row).toHaveCount(0);
  await expect(page.getByText(label)).toHaveCount(0);
});

test('home links through to the full event list', async ({ page }) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/app');

  await page
    .getByRole('link', { name: 'Tout voir' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/events$/);
});
