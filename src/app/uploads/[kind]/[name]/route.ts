import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import {
  etagFor,
  mimeForFile,
  resolveUploadPath,
} from '@/lib/uploads';

/**
 * Serves stored uploads.
 *
 * These files sit outside public/ — the running container cannot write there
 * and a deploy would wipe it — so they are read and returned here instead.
 *
 * No authorisation check: the filename is a random UUID, so the path is the
 * capability. Gating on friendship would break the moment a list is shared,
 * and an image is not the secret — who reserved the gift is, and that never
 * appears here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; name: string }> },
) {
  const { kind, name } = await params;

  const path = resolveUploadPath(kind, name);
  if (!path) return new NextResponse('Not found', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const etag = etagFor(bytes);
  // A replaced image gets a new UUID, so the content at a given path never
  // changes and the browser can be told to keep it indefinitely.
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeForFile(name),
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
    },
  });
}
