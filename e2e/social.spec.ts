import { expect, test, type Page } from '@playwright/test';
import {
  createScenario,
  destroyScenario,
  disconnect,
  TEST_PASSWORD,
  type Scenario,
} from './fixtures';

/*
 * KNOWN: this file is still flaky when the whole of it runs.
 *
 * Two real defects were fixed here — a strict-mode violation on getByText('404')
 * and a li-scoped locator that could never match, PersonCard being a div — and
 * the failure rate dropped from 2-4 per run to 1-2. It is not gone.
 *
 * What was ruled out, so nobody repeats it: leftover database rows (the run
 * ends with the four seed users and nothing else), a search collision (the
 * lookup is by exact email), and the app being slow (15s is no better than
 * 5s). Driven on its own, in a scratch spec, the flow completes in under 8s
 * every time; it only misbehaves as part of the full file. A revalidatePath
 * on /search was tried as a fix and made it measurably worse — /search reads
 * searchParams, so the path-level revalidation does not do what it looks like
 * it does. Do not re-add it.
 *
 * The next step is a full Playwright trace of a failing run, to see what the
 * page actually holds at the moment it stops.
 */

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

/**
 * Sends a friend request and waits for the card to catch up.
 *
 * "Demande envoyée" only appears once the server action has revalidated and
 * the card comes back with relation === 'pending-sent', so the wait is on the
 * label rather than on the click. The longer timeout is headroom for a slow
 * emulated phone; it is not a fix for the flakiness these specs still show
 * when the whole file runs — see the note at the top of the file.
 */
async function sendRequest(page: Page) {
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 15_000 });
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
  await sendRequest(page);

  // Before acceptance, their list is out of reach.
  await page.goto(`/lists/${scenario.listId}`);
  // The heading, not the text: the desktop bar carries the signed-in user's
  // name, and a scenario tag that happens to contain "404" matches too, which
  // is a strict-mode violation rather than a failure anybody can read.
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();

  // The recipient accepts.
  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto('/friends');
  await expect(page.getByText(/Demandes reçues/)).toBeVisible();
  await page.getByRole('button', { name: 'Accepter' }).click();

  /*
   * Wait on the count rather than on the button.
   *
   * The button is only `disabled` while the action runs — it stays in the DOM
   * until the server sends back a card with a new relation, so waiting for it
   * to disappear waits on the same round trip twice over.
   *
   * The fixture owner already has two friends, so acceptance makes three.
   */
  await expect(page.getByText(/^Amis \(3\)$/)).toBeVisible({ timeout: 15_000 });

  // Now the requester can see the list.
  await signOut(page);
  await signIn(page, outsider.ownerEmail);
  await page.goto(`/lists/${scenario.listId}`);
  await expect(page.getByRole('heading')).toBeVisible();
});

test('a friend request can be declined', async ({ page }) => {
  await signIn(page, outsider.ownerEmail);
  await page.goto(`/search?q=${encodeURIComponent(scenario.ownerEmail)}`);
  await sendRequest(page);

  await signOut(page);
  await signIn(page, scenario.ownerEmail);
  await page.goto('/friends');
  // Same reasoning as the acceptance above: the button outlives the click, so
  // the signal is the request leaving the page.
  const decline = page.getByRole('button', { name: 'Refuser' });
  await decline.click();
  await expect(decline).toHaveCount(0, { timeout: 15_000 });
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

  // Count the buttons rather than scope to a row: PersonCard renders a div,
  // not a li, so a li-based locator matches nothing and only ever times out.
  // Two friends means two Retirer; one going is the signal the action landed.
  const remove = page.getByRole('button', { name: 'Retirer' });
  await expect(remove).toHaveCount(2);
  await remove.first().click();
  await expect(page.getByText(/^Amis \(1\)$/)).toBeVisible({ timeout: 15_000 });
});

test('notifications arrive and can be cleared', async ({ page }) => {
  await signIn(page, outsider.ownerEmail);
  await page.goto(`/search?q=${encodeURIComponent(scenario.ownerEmail)}`);
  await sendRequest(page);

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
