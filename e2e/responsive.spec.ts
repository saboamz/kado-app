import { expect, test, type Page } from '@playwright/test';

const DEMO = { email: 'sophie@kado.app', password: 'kado1234' };

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(DEMO.email);
  await page.getByLabel('Mot de passe').fill(DEMO.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
}

/** Nothing may push the page sideways: horizontal scroll on a phone is a bug. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
}

test.describe('the app frame adapts to the viewport', () => {
  test('fits every common screen width without sideways scroll', async ({
    page,
  }) => {
    await signIn(page);
    for (const width of [320, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('shows the navigation as a bottom bar on a phone', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const box = (await nav.boundingBox())!;
    // Anchored to the bottom edge and spanning the full width.
    expect(box.y + box.height).toBeGreaterThan(800);
    expect(box.width).toBe(390);
  });

  test('moves the navigation to the top on a desktop', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const box = (await nav.boundingBox())!;
    // Across the top edge, full width and short. The design moved this from a
    // left sidebar: on a wishlist the content is short and wide-ish, so a
    // 236px rail spent width on five links that fit comfortably in a bar.
    expect(box.y).toBe(0);
    expect(box.width).toBe(1440);
    expect(box.height).toBeLessThan(120);
  });

  test('keeps every tap target comfortably large on a phone', async ({
    page,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    for (const link of await nav.getByRole('link').all()) {
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('marks the current section in the navigation', async ({ page }) => {
    await signIn(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('badges unread notifications', async ({ page }) => {
    await signIn(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(
      nav.getByRole('link', { name: /Alertes/ }).getByText('2'),
    ).toBeVisible();
  });

  test('reads real data from the database', async ({ page }) => {
    await signIn(page);
    // Seeded lists and friends, not fixtures baked into the page.
    // The count is matched by shape rather than value: other specs add and
    // remove wishes against the same database, so pinning "5 envies" would
    // make this fail for reasons that have nothing to do with the frame.
    await expect(page.getByText('Anniversaire').first()).toBeVisible();
    await expect(page.getByText(/\d+ envies?/).first()).toBeVisible();
    await expect(page.getByText(/Thomas Bel/).first()).toBeVisible();
  });
});
