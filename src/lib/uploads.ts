import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_UPLOAD_BYTES } from './upload-limits';

/**
 * Where uploaded files live.
 *
 * Deliberately outside .next and outside public/: Next serves public/ from
 * the build output, which a running container cannot write to, and anything
 * written there would be lost on the next deploy. This directory is a Docker
 * volume in production and a gitignored folder in development.
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), '.uploads');

export { MAX_UPLOAD_BYTES } from './upload-limits';

/**
 * The formats we accept, keyed by the magic bytes that actually start the
 * file. A browser-supplied MIME type is just a claim; these are checked
 * against the real content so a renamed .exe cannot pass as a .png.
 */
const SIGNATURES: Array<{ ext: string; mime: string; match: (b: Buffer) => boolean }> =
  [
    {
      ext: 'png',
      mime: 'image/png',
      match: (b) =>
        b.length > 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47,
    },
    {
      ext: 'jpg',
      mime: 'image/jpeg',
      match: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
      ext: 'webp',
      mime: 'image/webp',
      match: (b) =>
        b.length > 12 &&
        b.toString('ascii', 0, 4) === 'RIFF' &&
        b.toString('ascii', 8, 12) === 'WEBP',
    },
    {
      ext: 'gif',
      mime: 'image/gif',
      match: (b) => b.length > 6 && b.toString('ascii', 0, 3) === 'GIF',
    },
  ];

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/** The kind of thing being uploaded, which decides where the file lands. */
export type UploadKind = 'gifts' | 'avatars';

export function detectImageType(bytes: Buffer) {
  return SIGNATURES.find((s) => s.match(bytes)) ?? null;
}

/** Serves a stored file back; null for anything that escapes the directory. */
export function resolveUploadPath(kind: string, name: string): string | null {
  // Path traversal: a name like ../../etc/passwd must never resolve outside
  // the upload directory, whatever the router hands us.
  if (!/^(gifts|avatars)$/.test(kind)) return null;
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|webp|gif)$/.test(name)) return null;
  return join(UPLOAD_DIR, kind, name);
}

export function mimeForFile(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1);
  return SIGNATURES.find((s) => s.ext === ext)?.mime ?? 'application/octet-stream';
}

/**
 * Validates and stores one uploaded image, returning the path to serve it at.
 *
 * The file is read fully into memory first — at 4 MB that is cheap, and it
 * lets the magic bytes be checked before anything touches the disk.
 */
export async function storeUpload(
  file: File,
  kind: UploadKind,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: 'Ce fichier est vide.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Cette image dépasse 4 Mo.' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // The declared type is ignored: only the content decides.
  const type = detectImageType(bytes);
  if (!type) {
    return {
      ok: false,
      error: 'Format non reconnu. Utilisez une image PNG, JPEG, WebP ou GIF.',
    };
  }

  const dir = join(UPLOAD_DIR, kind);
  await mkdir(dir, { recursive: true });

  // A random name, not the uploader's: their filename may collide, contain
  // path separators, or leak something they did not mean to share.
  const name = `${randomUUID()}.${type.ext}`;
  await writeFile(join(dir, name), bytes);

  return { ok: true, path: `/uploads/${kind}/${name}` };
}

/**
 * Removes a previously stored upload, ignoring anything that is not one of
 * ours — an external URL, or a file already gone.
 */
export async function deleteUpload(path: string | null): Promise<void> {
  if (!path) return;
  const match = /^\/uploads\/(gifts|avatars)\/([A-Za-z0-9_-]+\.\w+)$/.exec(path);
  if (!match) return;

  const resolved = resolveUploadPath(match[1]!, match[2]!);
  if (!resolved) return;

  try {
    await unlink(resolved);
  } catch {
    // Already gone is the outcome we wanted.
  }
}

/** A stable cache key so a replaced image is not served from a stale cache. */
export function etagFor(bytes: Buffer): string {
  return `"${createHash('sha1').update(bytes).digest('hex')}"`;
}
