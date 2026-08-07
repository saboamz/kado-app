import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { UploadKind } from './upload-limits';

/**
 * Where stored images actually live.
 *
 * Two backends behind one interface, chosen by whether a Blob token is
 * present:
 *
 *   disk — a folder on the filesystem. The default for development, for the
 *     test suite, and for a container deployment with a mounted volume.
 *
 *   blob — Vercel Blob. Required on Vercel, where the function filesystem is
 *     ephemeral and unshared: a file written by one invocation is gone on the
 *     next and was never visible to any other instance. Writing to disk there
 *     does not fail loudly — the upload appears to work and 404s seconds
 *     later, for everyone including the uploader.
 *
 * The split is deliberately at storage only. Validation, magic-byte sniffing
 * and Sharp normalisation stay in uploads.ts and run identically either way,
 * so the security properties do not depend on where the bytes land.
 */

/** True when the app should use Vercel Blob rather than the local disk. */
export function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Where the disk backend keeps its files.
 *
 * Outside .next and outside public/: Next serves public/ from the build
 * output, which a running server cannot write to, and anything written there
 * would be lost on the next deploy.
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), '.uploads');

/**
 * Stores normalised bytes and returns the URL to serve them at.
 *
 * The name is a random UUID rather than the uploader's filename, which may
 * collide, contain path separators, or leak something they did not mean to
 * share. Everything is WebP by this point, whatever arrived.
 */
export async function putImage(
  bytes: Buffer,
  kind: UploadKind,
): Promise<string> {
  const name = `${randomUUID()}.webp`;

  if (usingBlob()) {
    // Imported lazily so a disk deployment never loads the SDK.
    const { put } = await import('@vercel/blob');
    const { url } = await put(`${kind}/${name}`, bytes, {
      access: 'public',
      contentType: 'image/webp',
      // The name is already unique; without this the SDK appends a suffix of
      // its own and the returned URL stops matching what we generated.
      addRandomSuffix: false,
      // The content at a given URL never changes — a replaced image gets a
      // new UUID — so it can be cached indefinitely.
      cacheControlMaxAge: 31536000,
    });
    return url;
  }

  const dir = join(UPLOAD_DIR, kind);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
  return `/uploads/${kind}/${name}`;
}

/**
 * Removes a stored image, ignoring anything that is not one of ours — an
 * external URL, or a file already gone.
 *
 * Both forms are accepted whatever the current backend, so images uploaded
 * before a migration can still be deleted afterwards.
 */
export async function removeImage(path: string | null): Promise<void> {
  if (!path) return;

  if (/^https?:\/\//.test(path)) {
    // A Blob URL. del() is a no-op for a URL that is already gone.
    if (!usingBlob()) return;
    try {
      const { del } = await import('@vercel/blob');
      await del(path);
    } catch {
      // Already gone is the outcome we wanted.
    }
    return;
  }

  const match = /^\/uploads\/(gifts|avatars)\/([A-Za-z0-9_-]+\.\w+)$/.exec(path);
  if (!match) return;

  try {
    await unlink(join(UPLOAD_DIR, match[1]!, match[2]!));
  } catch {
    // Already gone is the outcome we wanted.
  }
}
