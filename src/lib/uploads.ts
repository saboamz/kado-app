import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { join } from 'node:path';
import { MAX_UPLOAD_BYTES, type UploadKind } from './upload-limits';
import { UPLOAD_DIR, putImage, removeImage } from './upload-store';

/**
 * Validating and normalising an uploaded image.
 *
 * Where the bytes end up is upload-store.ts's problem — local disk in
 * development, Vercel Blob in production. Everything here runs identically
 * either way, so the security properties do not depend on the backend.
 */
export { UPLOAD_DIR };
export { MAX_UPLOAD_BYTES } from './upload-limits';
export type { UploadKind } from './upload-limits';

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

/**
 * What every stored image is normalised to.
 *
 * Uploads arrive at whatever size the camera produced — a 4 MB portrait next
 * to a 200 KB screenshot. Storing them as-is means the layout has to crop to
 * stay regular, which hides part of the picture. Normalising on the way in
 * lets every image be shown whole at a predictable cost.
 *
 * `fit: 'inside'` scales the longest edge down to the bound and stops; it
 * never crops and never enlarges a small image. The remaining space is left
 * to CSS rather than baked in as padding, so the surround follows the theme
 * instead of being a fixed colour burnt into the file.
 */
const NORMALISED = {
  gifts: { maxEdge: 1600, quality: 82 },
  avatars: { maxEdge: 512, quality: 85 },
} as const;

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

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

  return storeImageBytes(Buffer.from(await file.arrayBuffer()), kind);
}

/**
 * The same validation and normalisation, for bytes that did not arrive as a
 * form upload — a product picture our server fetched from a merchant. One
 * path for both means a downloaded file cannot skip a check an uploaded one
 * would have faced.
 */
export async function storeImageBytes(
  bytes: Buffer,
  kind: UploadKind,
): Promise<UploadResult> {
  // The declared type is ignored: only the content decides.
  const type = detectImageType(bytes);
  if (!type) {
    return {
      ok: false,
      error: 'Format non reconnu. Utilisez une image PNG, JPEG, WebP ou GIF.',
    };
  }

  const { maxEdge, quality } = NORMALISED[kind];

  let normalised: Buffer;
  try {
    normalised = await sharp(bytes, { animated: type.ext === 'gif' })
      .rotate() // Honour the EXIF orientation before it is stripped below.
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
  } catch {
    // sharp rejects a file whose header passed our check but whose body is
    // truncated or corrupt — worth its own message, not a generic failure.
    return { ok: false, error: 'Cette image semble illisible.' };
  }

  return { ok: true, path: await putImage(normalised, kind) };
}

/**
 * Removes a previously stored upload, ignoring anything that is not one of
 * ours — an external URL, or a file already gone.
 */
export async function deleteUpload(path: string | null): Promise<void> {
  await removeImage(path);
}

/** A stable cache key so a replaced image is not served from a stale cache. */
export function etagFor(bytes: Buffer): string {
  return `"${createHash('sha1').update(bytes).digest('hex')}"`;
}
