import { defineConfig, devices } from '@playwright/test';

/** A browser that asks for French. See the comment in `use` below. */
const FRENCH = {
  locale: 'fr-FR',
  extraHTTPHeaders: { 'accept-language': 'fr-FR,fr;q=0.9' },
} as const;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    /*
     * Ask for French, explicitly.
     *
     * Signed out, the app answers in the language the browser asks for — and
     * Playwright's device presets carry locale: 'en-US', so /login and
     * /signup came back in English while every assertion here is written in
     * French. The suite covers the French app; saying so is better than
     * relying on a default that a device preset silently overrides.
     *
     * Signed-in pages are unaffected either way: there the account's own
     * preference wins, and the seed leaves it at the 'fr' default.
     */
    ...FRENCH,
  },
  projects: [
    /*
     * The device preset is spread FIRST, so the French locale below wins.
     *
     * Project-level `use` overrides the top-level one, and both presets carry
     * locale: 'en-US' — set the other way round, the top-level setting would
     * be silently discarded and this whole file would look correct while the
     * app answered in English.
     */
    // The app is mobile-first, so the phone viewport is the primary target.
    { name: 'mobile', use: { ...devices['Pixel 7'], ...FRENCH } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...FRENCH } },
  ],
  webServer: {
    // Clear .next first: editing source while a build is cached leaves the
    // directory inconsistent, and next start then dies on a missing chunk.
    command: 'rm -rf .next && npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
