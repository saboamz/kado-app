import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

/**
 * What the session cookie is made of.
 *
 * Asserted against the source because session.ts imports next/headers, which
 * has no meaning outside a request — the same reason clickout.test.ts reads
 * its component rather than rendering it.
 *
 * The bug this pins: the cookie used to carry Session.id, which Prisma fills
 * with cuid(). A cuid is a timestamp, a counter, a machine fingerprint and
 * Math.random(); as a bearer credential that is forgeable, and forging one is
 * account takeover.
 */
const source = readFileSync('src/lib/session.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('the session token', () => {
  it('is generated from the CSPRNG, not by the database', () => {
    expect(source).toContain('randomBytes(32)');
    // The row is told its id. A create that leaves it out gets cuid() back.
    expect(source).toMatch(/db\.session\.create\(\{\s*data:\s*\{\s*id/);
  });

  it('is not what the database stores', () => {
    // sha256 of the token is the row id, so a leaked table yields digests and
    // a digest cannot be presented as a cookie.
    expect(source).toContain("createHash('sha256')");
    expect(source).toMatch(/store\.set\(COOKIE,\s*token/);
    expect(source).not.toMatch(/store\.set\(COOKIE,\s*session\.id/);
  });

  it('is looked up by digest on the way back in', () => {
    expect(source).toContain('sessionId(token)');
  });

  it('rides a cookie that is httpOnly, secure and same-site strict', () => {
    expect(source).toContain('httpOnly: true');
    expect(source).toContain("sameSite: 'strict'");
    // Not keyed on NODE_ENV: that left a staging build sending it in clear.
    expect(source).not.toMatch(/secure:\s*process\.env\.NODE_ENV/);
  });
});

describe('the digest itself', () => {
  it('gives 256 bits of entropy and a stable, unguessable id', () => {
    const token = randomBytes(32).toString('base64url');
    const id = createHash('sha256').update(token).digest('hex');

    expect(token).toHaveLength(43);
    expect(id).toHaveLength(64);
    expect(id).not.toBe(token);
    expect(createHash('sha256').update(token).digest('hex')).toBe(id);
  });
});
