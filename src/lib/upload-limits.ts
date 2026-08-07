/**
 * Shared with the client component, which cannot import from uploads.ts —
 * that module reaches for node:fs and would break the browser bundle.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The kind of thing being uploaded, which decides where the file lands. */
export type UploadKind = 'gifts' | 'avatars';
