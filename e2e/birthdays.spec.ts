import { expect, test, type Page } from '@playwright/test';
import { TEST_PASSWORD } from './fixtures';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

test('the birthdays page lists friends by how soon their day falls', async ({
  page,
}) => {
  // The seed gives Sophie three friends with birthdays 12, 24 and 45 days out.
  await signIn(page, 'sophie@kado.app');
  await page.goto('/birthdays');

  await expect(page.getByRole('heading', { name: 'Anniversaires' })).toBeVisible();
  await expect(page.getByText('Dans le mois')).toBeVisible();
  await expect(page.getByText('Thomas Bel')).toBeVisible();

  // The nearest birthday is listed before the more distant ones.
  const names = await page.locator('a[href^="/u/"]').allInnerTexts();
  expect(names[0]).toContain('Thomas');
});

test('home links through to the full birthday list', async ({ page }) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/app');

  await page
    .getByRole('link', { name: 'Tout voir' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/birthdays$/);
});
