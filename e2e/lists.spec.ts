import { expect, test, type Page } from '@playwright/test';

async function signOut(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('kado1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

test('a full list lifecycle: create, add a wish, edit it, delete the list', async ({
  page,
}) => {
  const listName = `Test ${Date.now()}`;
  const wish = `Théière ${Date.now()}`;
  await signIn(page, 'sophie@kado.app');

  // Create.
  await page.goto('/lists');
  await page.getByRole('link', { name: /Nouvelle liste/ }).click();
  await page.getByLabel('Nom de la liste').fill(listName);
  await page.getByLabel('Occasion').fill('Pour tester');
  await page.getByRole('button', { name: 'Créer la liste' }).click();

  await expect(page.getByRole('heading', { name: listName })).toBeVisible();
  await expect(page.getByText('Cette liste est vide')).toBeVisible();

  // Add a wish.
  await page.getByRole('link', { name: /Ajouter/ }).first().click();
  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill(wish);
  await page.getByLabel('Lien').fill('boutique.fr/theiere');
  await page.getByLabel('Prix').fill('42,50');
  await page.getByRole('button', { name: 'Ajouter à ma liste' }).click();

  await expect(page.getByText(wish)).toBeVisible();
  await expect(page.getByText('42,50 €')).toBeVisible();

  // The bare domain became a real link and the shop was derived from it.
  await page.getByText(wish).click();
  await expect(page.getByText('boutique.fr', { exact: false })).toBeVisible();
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
  // Unique per run: the same spec runs on two viewports against one database,
  // and a shared name would make the second run match two elements.
  const wish = `Idée libre ${Date.now()}`;

  await signIn(page, 'sophie@kado.app');
  await page.goto('/lists');
  await page.getByText('Anniversaire').first().click();
  await page.getByRole('link', { name: /Ajouter/ }).first().click();

  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill(wish);
  await page.getByRole('button', { name: 'Ajouter à ma liste' }).click();

  // Saved with no price, no link and no shop.
  await expect(page.getByText(wish)).toBeVisible();
  await page.getByText(wish).click();
  await expect(page.getByRole('heading', { name: wish })).toBeVisible();
  await expect(page.getByText('—')).toBeVisible();

  // Remove it so the seeded list stays as the seed left it.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('link', { name: 'Modifier' }).click();
  await page.getByRole('button', { name: 'Supprimer cette envie' }).click();
  await expect(page.getByText(wish)).toHaveCount(0);
});

test('an empty name is refused', async ({ page }) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/lists/new');
  await page.getByRole('button', { name: 'Créer la liste' }).click();
  await expect(page.locator('#name-error')).toBeVisible();
  await expect(page).toHaveURL(/\/lists\/new$/);
});

test('an unreadable price is reported rather than silently dropped', async ({
  page,
}) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/lists');
  await page.getByText('Anniversaire').first().click();
  await page.getByRole('link', { name: /Ajouter/ }).first().click();

  await page.getByLabel(/Qu'est-ce qui vous ferait plaisir/).fill(`Prix douteux ${Date.now()}`);
  await page.getByLabel('Prix').fill('beaucoup');
  await page.getByRole('button', { name: 'Ajouter à ma liste' }).click();

  await expect(page.locator('#price-error')).toHaveText(/invalide/);
});

test('a friend can read a list but not shape it', async ({ page }) => {
  // Thomas is Sophie's friend: he may see her list, never edit it.
  await signIn(page, 'sophie@kado.app');
  await page.goto('/lists');
  await page.getByText('Anniversaire').first().click();
  await expect(page).toHaveURL(/\/lists\/[a-z0-9]+$/);
  const listUrl = page.url();

  await signOut(page);
  await signIn(page, 'thomas@kado.app');

  await page.goto(listUrl);
  await expect(page.getByRole('heading', { name: 'Anniversaire' })).toBeVisible();
  await expect(page.getByText("Liste de Sophie Marchand")).toBeVisible();

  // No owner controls on the page…
  await expect(page.getByRole('link', { name: 'Modifier' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Ajouter/ })).toHaveCount(0);

  // …and the route itself refuses, so hiding the button is not the defence.
  await page.goto(`${listUrl}/edit`);
  await expect(page.getByText('404')).toBeVisible();
});

test('a stranger cannot see a friends-only list at all', async ({ page }) => {
  await signIn(page, 'sophie@kado.app');
  await page.goto('/lists');
  await page.getByText('Anniversaire').first().click();
  const listUrl = page.url();

  await signOut(page);

  // Signed out entirely: the list must not resolve.
  await page.goto(listUrl);
  await expect(page).toHaveURL(/\/login$/);
});
