'use client';

import { useState, useTransition } from 'react';
import { useErrorText, useT } from '@/lib/i18n/client';
import { reportGift, reportProfile } from '@/lib/report-actions';
import styles from './report.module.css';

/**
 * A quiet way to say that something is not acceptable.
 *
 * Deliberately small and low-contrast: it sits under content most people will
 * never want to report, and a prominent button would suggest the app expects
 * trouble. Somebody who needs it will look for it.
 *
 * The person reported is never told — see report-actions.ts. That is what
 * makes it usable between people who know each other socially.
 */
export function ReportButton({
  subjectId,
  giftId,
}: {
  /** A profile, or a wish. Exactly one. */
  subjectId?: string;
  giftId?: string;
}) {
  const t = useT();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className={styles.thanks}>{t('report.thanks')}</p>;
  }

  if (!open) {
    return (
      <button type="button" className={styles.link} onClick={() => setOpen(true)}>
        {t('report.link')}
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>{t('report.title')}</p>
      <p className={styles.intro}>{t('report.intro')}</p>

      <label className="srOnly" htmlFor="report-reason">
        {t('report.title')}
      </label>
      <textarea
        id="report-reason"
        className={styles.input}
        rows={3}
        maxLength={500}
        value={reason}
        placeholder={t('report.placeholder')}
        onChange={(e) => setReason(e.target.value)}
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.send}
          disabled={pending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = giftId
                ? await reportGift(giftId, reason)
                : await reportProfile(subjectId!, reason);
              if (result.error) setError(result.error);
              else setDone(true);
            })
          }
        >
          {pending ? t('report.sending') : t('report.send')}
        </button>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => setOpen(false)}
        >
          {t('report.cancel')}
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
