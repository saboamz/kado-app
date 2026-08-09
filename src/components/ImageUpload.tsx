'use client';

import { useRef, useState } from 'react';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import { useT } from '@/lib/i18n/client';
import { UploadedImage } from './UploadedImage';
import styles from './imageUpload.module.css';

/**
 * Picks an image and previews it before the form is submitted.
 *
 * The file rides along in the form's own FormData rather than being uploaded
 * separately, so a half-finished form leaves no orphaned file on disk.
 */
export function ImageUpload({
  name,
  label,
  initialUrl,
  shape = 'rect',
  serverError,
}: {
  name: string;
  label: string;
  initialUrl?: string | null;
  shape?: 'rect' | 'circle';
  /** A refusal from the action — a wrong format is only detectable there. */
  serverError?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  // A locally-detected problem wins; otherwise show whatever the server said
  // about the file that is still selected.
  const shown = error ?? serverError ?? null;
  // Tracks a removal so the action knows to clear a previously saved image.
  const [removed, setRemoved] = useState(false);

  function choose(file: File | undefined) {
    if (!file) return;
    setError(null);

    // Checked again on the server, where it counts; this is only to spare
    // somebody a slow upload that was always going to be refused.
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('upload.tooLarge'));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setRemoved(false);
    setPreview(URL.createObjectURL(file));
  }

  function remove() {
    setPreview(null);
    setRemoved(true);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={styles.upload}>
      <span className={styles.label}>{label}</span>

      <div className={styles.row}>
        {preview ? (
          <UploadedImage
            src={preview}
            className={
              shape === 'circle' ? styles.previewCircle : styles.preview
            }
          />
        ) : (
          <span className={styles.placeholder} data-shape={shape} aria-hidden />
        )}

        <div className={styles.controls}>
          <label className={styles.button}>
            {preview ? t('image.change') : t('image.choose')}
            <input
              ref={inputRef}
              type="file"
              name={name}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className={styles.input}
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>

          {preview && (
            <button type="button" className={styles.remove} onClick={remove}>
              Retirer
            </button>
          )}

          <span className={styles.hint}>PNG, JPEG, WebP ou GIF — 4 Mo max.</span>
        </div>
      </div>

      {/* Tells the action to clear a saved image rather than keep it. */}
      {removed && <input type="hidden" name={`${name}Removed`} value="1" />}

      {shown && (
        <p className={styles.error} role="alert">
          {shown}
        </p>
      )}
    </div>
  );
}
