import { expect, test, type Page } from '@playwright/test';
import {
  createScenario,
  destroyScenario,
  disconnect,
  TEST_PASSWORD,
  type Scenario,
} from './fixtures';

/** Specs that add or remove wishes work on their own list, never the seed's. */
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

test('a full list lifecycle: create, add a wish, edit it, delete the list', async ({
  page,
}) => {
  const listName = `Test ${Date.now()}`;
  const wish = `Théière ${Date.now()}`;
  await signIn(page, scenario.ownerEmail);

  // Create.
  await page.goto('/lists');
  await page.getByRole('link', { name: /Nouvelle liste/ }).click();
  await page.getByLabel('Nom de la liste').fill(listName);
  await page.getByLabel('Occasion').fill('Pour tester');
  await page.getByRole('button', { name: 'Créer la liste' }).click();

  await expect(page.getByRole('heading', { name: listName })).toBeVisible();
  await expect(page.getByText('Cette liste est vide')).toBeVisible();

  // Add a wish. Wait for the form's own route rather than assuming the click
  // landed: on mobile the empty state and the header both offer "Ajouter",
  // and filling a field on a page that has not arrived yet times out on a
  // locator that is about to exist.
  await page.getByRole('link', { name: /Ajouter/ }).first().click();
  await page.waitForURL('**/gifts/new');
  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill(wish);
  await page.getByLabel('Lien').fill('boutique.fr/theiere');
  await page.getByLabel('Prix').fill('42,50');
  await page.getByRole('button', { name: 'Ajouter à ma liste' }).click();

  await expect(page.getByText(wish)).toBeVisible();
  await expect(page.getByText('42,50 €')).toBeVisible();

  // The bare domain became a real link and the shop was derived from it.
  //
  // Wait for the gift page before asserting on the merchant link. The card on
  // the list page carries the shop name in its own accessible name, so
  // /boutique\.fr/ matches the card too — and while the navigation is still in
  // flight it matches it first, then fails on the card's own /gifts/… href.
  await page.getByText(wish).click();
  await page.waitForURL(/\/gifts\/[a-z0-9]+$/);
  // Exact match: the card shows the shop name and the full URL, and both
  // contain "boutique.fr", so a substring match resolves to two elements.
  await expect(page.getByText('boutique.fr', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /boutique\.fr/ }),
  ).toHaveAttribute('href', 'https://boutique.fr/theiere');

  // Edit the wish.
  await page.getByRole('link', { name: 'Modifier' }).click();
  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill(`${wish} en fonte`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('heading', { name: `${wish} en fonte` }),
  ).toBeVisible();

  // Wait for the save redirect to settle before navigating away, or the
  // goto races it and Playwright aborts the frame.
  await expect(page).toHaveURL(/\/gifts\/[a-z0-9]+$/);

  // Delete the list, and with it the wish.
  page.once('dialog', (d) => d.accept());
  await page.goto(`/lists`);
  await page.getByText(listName).click();
  await page.getByRole('link', { name: 'Modifier' }).click();
  await page.getByRole('button', { name: 'Supprimer la liste' }).click();
  await page.waitForURL('**/lists');
  await expect(page.getByText(listName)).toHaveCount(0);
});

test('a wish needs only a name', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/lists/${scenario.listId}`);
  await page.getByRole('link', { name: /Ajouter/ }).first().click();

  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill('Une idée libre');
  await page.getByRole('button', { name: 'Ajouter à ma liste' }).click();

  // Saved with no price, no link and no shop.
  await expect(page.getByText('Une idée libre')).toBeVisible();
  await page.getByText('Une idée libre').click();
  await expect(
    page.getByRole('heading', { name: 'Une idée libre' }),
  ).toBeVisible();
  await expect(page.getByText('—')).toBeVisible();
});

test('an empty name is refused', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/lists/new');
  await page.getByRole('button', { name: 'Créer la liste' }).click();
  await expect(page.locator('#name-error')).toBeVisible();
  await expect(page).toHaveURL(/\/lists\/new$/);
});

test('an unreadable price is reported rather than silently dropped', async ({
  page,
}) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto(`/lists/${scenario.listId}`);
  await page.getByRole('link', { name: /Ajouter/ }).first().click();

  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill('Prix douteux');
  await page.getByLabel('Prix').fill('beaucoup');
  await page.getByRole('button', { name: 'Ajouter à ma liste' }).click();

  await expect(page.locator('#price-error')).toHaveText(/invalide/);
});

test('a friend can read a list but not shape it', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  const listUrl = `/lists/${scenario.listId}`;

  await page.goto(listUrl);
  await expect(page.getByRole('heading')).toBeVisible();

  // No owner controls on the page…
  await expect(page.getByRole('link', { name: 'Modifier' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Ajouter/ })).toHaveCount(0);

  // …and the route itself refuses, so hiding the button is not the defence.
  await page.goto(`${listUrl}/edit`);
  await expect(page.getByText('404')).toBeVisible();
});

test('a stranger cannot see a friends-only list at all', async ({ page }) => {
  // Signed out entirely: the list must not resolve.
  await page.goto(`/lists/${scenario.listId}`);
  await expect(page).toHaveURL(/\/login$/);
});
