import { expect, test, type Page } from '@playwright/test';
import {
  createScenario,
  destroyScenario,
  disconnect,
  TEST_PASSWORD,
  type Scenario,
} from './fixtures';

let scenario: Scenario;
let outsider: Scenario;

test.beforeEach(async () => {
  scenario = await createScenario();
  // A second, unrelated set of people to befriend.
  outsider = await createScenario();
});

test.afterEach(async () => {
  await destroyScenario(scenario);
  await destroyScenario(outsider);
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

test('a friend request can be sent, accepted, and unlocks the lists', async ({
  page,
}) => {
  await signIn(page, outsider.ownerEmail);

  // Find the other scenario's owner by their exact address.
  await page.goto(`/search?q=${encodeURIComponent(scenario.ownerEmail)}`);
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Demande envoyée')).toBeVisible();

  // Before acceptance, their list is out of reach.
  await page.goto(`/lists/${scenario.listId}`);
  await expect(page.getByText('404')).toBeVisible();

  // The recipient accepts.
  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto('/friends');
  await expect(page.getByText(/Demandes reçues/)).toBeVisible();
  await page.getByRole('button', { name: 'Accepter' }).click();
  // The fixture owner already has two friends, so this makes three.
  await expect(page.getByText(/^Amis \(3\)$/)).toBeVisible();

  // Now the requester can see the list.
  await signOut(page);
  await signIn(page, outsider.ownerEmail);
  await page.goto(`/lists/${scenario.listId}`);
  await expect(page.getByRole('heading')).toBeVisible();
});

test('a friend request can be declined', async ({ page }) => {
  await signIn(page, outsider.ownerEmail);
  await page.goto(`/search?q=${encodeURIComponent(scenario.ownerEmail)}`);
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Demande envoyée')).toBeVisible();

  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto('/friends');
  await page.getByRole('button', { name: 'Refuser' }).click();

  await expect(page.getByText(/Demandes reçues/)).toHaveCount(0);
  await page.goto(`/lists/${scenario.listId}`);
  await expect(page.getByRole('heading')).toBeVisible();
});

test('search finds a person by name', async ({ page }) => {
  await signIn(page, scenario.friendEmail);
  await page.goto('/search');

  // The tag matches all three people in this scenario, minus the searcher
  // themselves, who is never returned in their own results.
  await page.getByLabel('Rechercher une personne').fill(scenario.tag);
  await expect(page.getByText(/2 résultats/)).toBeVisible();
  // Scoped to the page: the desktop nav carries a link to the signed-in
  // user's own profile, whose name is "Ami <tag>" in this scenario.
  const results = page.getByRole('main');
  await expect(
    results.getByRole('link', { name: new RegExp(`Ami ${scenario.tag}`) }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: new RegExp(`Propriétaire ${scenario.tag}`) }),
  ).toBeVisible();
});

test('search will not match a partial e-mail address', async ({ page }) => {
  await signIn(page, scenario.friendEmail);

  // Enumerating addresses by prefix must not work.
  const prefix = scenario.ownerEmail.slice(0, 10);
  await page.goto(`/search?q=${encodeURIComponent(prefix)}`);
  await expect(page.getByText('Personne trouvée')).toBeVisible();
});

test('a friendship can be ended from the friends page', async ({ page }) => {
  await signIn(page, scenario.ownerEmail);
  await page.goto('/friends');
  await expect(page.getByText(/^Amis \(2\)$/)).toBeVisible();

  await page.getByRole('button', { name: 'Retirer' }).first().click();
  await expect(page.getByText(/^Amis \(1\)$/)).toBeVisible();
});

test('notifications arrive and can be cleared', async ({ page }) => {
  await signIn(page, outsider.ownerEmail);
  await page.goto(`/search?q=${encodeURIComponent(scenario.ownerEmail)}`);
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Demande envoyée')).toBeVisible();

  await signOut(page);
  await signIn(page, scenario.ownerEmail);

  // The request shows as an unread notification, badged in the navigation.
  // Target the badge by its accessible text: the nav also carries the signed-in
  // user's name, which can itself contain the digit.
  //
  // Singular OR plural: the badge used to say "notifications non lues"
  // whatever the count, and now agrees with it — one request reads
  // "1 notification non lue".
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(
    nav.getByRole('link', { name: /notifications? non lues?/ }),
  ).toBeVisible();

  await page.goto('/notifications');
  await expect(page.getByText(/souhaite devenir votre ami/)).toBeVisible();
  // "Non lue" is visually-hidden text beside the dot, not an aria-label on
  // it: a label on a bare span with no role is not reliably announced, so the
  // unread state used to rest on colour alone.
  await expect(page.getByText('Non lue', { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(page.getByText('Non lue', { exact: true })).toHaveCount(0);
});
