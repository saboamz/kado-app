import { Resend } from 'resend';
import type { Locale } from './i18n/locales';
import { translatorFor } from './i18n/server';
import type { TFunction } from './i18n/t';

/**
 * The one e-mail this app sends: "choose a new password".
 *
 * ── Why the templates are handwritten ──────────────────────────────────────
 *
 * One transactional message does not earn a templating dependency. The HTML
 * below is a single column of text with one button — written once, in both
 * languages through the same dictionaries as every screen, with the URL
 * repeated in clear for the clients that strip styles, and a text/plain twin
 * because filters trust mail that has one.
 *
 * ── Why missing RESEND_API_KEY is not an error ─────────────────────────────
 *
 * Without the key the reset URL is logged instead of sent. That is the
 * development and test mode, on purpose: e2e runs stay offline, and `next
 * dev` shows the link in the terminal where a developer is already looking.
 * Production sets the key; previews deliberately do not.
 */

const FROM = 'Kadlio <contact@kadlio.com>';

export async function sendPasswordResetEmail(args: {
  to: string;
  name: string;
  locale: Locale;
  url: string;
  /** The token row's id — never the token itself. It keys idempotency: a
      retried request resends THIS e-mail instead of minting a duplicate. */
  tokenId: string;
}): Promise<void> {
  const t = translatorFor(args.locale);

  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] password reset for ${args.to}: ${args.url}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  // The SDK answers { data, error } and never throws for API failures. This
  // runs after the response has left (see requestPasswordReset), so there is
  // nobody to show an error to — the log and the Resend dashboard are it.
  const { error } = await resend.emails.send(
    {
      from: FROM,
      to: [args.to],
      subject: t('email.resetSubject'),
      html: resetEmailHtml(t, args.locale, args.name, args.url),
      text: resetEmailText(t, args.name, args.url),
    },
    { idempotencyKey: `reset-email/${args.tokenId}` },
  );
  if (error) {
    console.error(`[email] password reset send failed for ${args.to}:`, error.message);
  }
}

/** Exported for the tests, which check both languages render and carry the URL. */
export function resetEmailHtml(
  t: TFunction,
  locale: Locale,
  name: string,
  url: string,
): string {
  const esc = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <title>${esc(t('email.resetSubject'))}</title>
  </head>
  <body style="margin:0;padding:24px;background:#eeeae5;font-family:Georgia,serif;color:#2b2723;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;">
      <p style="font-size:20px;font-weight:bold;margin:0 0 16px;">Kadlio</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">${esc(t('email.resetGreeting', { name }))}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">${esc(t('email.resetBody'))}</p>
      <p style="margin:0 0 20px;">
        <a href="${esc(url)}" style="display:inline-block;background:#00707d;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-size:15px;">${esc(t('email.resetButton'))}</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0 0 4px;">${esc(t('email.resetLinkFallback'))}</p>
      <p style="font-size:13px;line-height:1.6;word-break:break-all;margin:0 0 20px;"><a href="${esc(url)}" style="color:#00707d;">${esc(url)}</a></p>
      <p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0;">${esc(t('email.resetIgnore'))}</p>
    </div>
  </body>
</html>`;
}

/** The text/plain twin — same words, no markup, URL on its own line. */
export function resetEmailText(t: TFunction, name: string, url: string): string {
  return [
    t('email.resetGreeting', { name }),
    '',
    t('email.resetBody'),
    '',
    url,
    '',
    t('email.resetIgnore'),
  ].join('\n');
}
