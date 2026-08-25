import { resetEmailHtml, resetEmailText, sendPasswordResetEmail } from './email';
import { translatorFor } from './i18n/server';

/**
 * The e-mail is the one part of the reset flow no browser test ever renders,
 * so its contract is pinned here: both languages produce their own words,
 * the URL survives into both bodies in clear, and without an API key the
 * send is a logged no-op — which is what keeps development and e2e offline.
 */

const URL = 'https://www.kadlio.com/reset-password?token=abc123';

it('renders both languages, distinctly, with the URL in clear', () => {
  const fr = resetEmailHtml(translatorFor('fr'), 'fr', 'Sophie', URL);
  const en = resetEmailHtml(translatorFor('en'), 'en', 'Sophie', URL);

  expect(fr).toContain('lang="fr"');
  expect(en).toContain('lang="en"');
  expect(fr).toContain(URL);
  expect(en).toContain(URL);
  expect(fr).toContain('Sophie');
  expect(fr).not.toBe(en);

  const text = resetEmailText(translatorFor('fr'), 'Sophie', URL);
  expect(text).toContain(URL);
  expect(text).not.toContain('<');
});

it('escapes what it interpolates', () => {
  const html = resetEmailHtml(
    translatorFor('fr'),
    'fr',
    '<script>alert(1)</script>',
    URL,
  );
  expect(html).not.toContain('<script>alert');
});

it('is a no-op without an API key — offline by design', async () => {
  const hadKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    await expect(
      sendPasswordResetEmail({
        to: 'delivered@resend.dev',
        name: 'Test',
        locale: 'fr',
        url: URL,
        tokenId: 'x',
      }),
    ).resolves.toBeUndefined();
  } finally {
    if (hadKey) process.env.RESEND_API_KEY = hadKey;
  }
});
