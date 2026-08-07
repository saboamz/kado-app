import { db } from './db';
import {
  clearAttempts,
  purgeOldAttempts,
  rateLimit,
  recordAttempt,
  retryMessage,
  type Limit,
} from './rate-limit';

/**
 * The limiter is security code: the assertion that matters is that it refuses,
 * not that it runs. Each test uses its own key so the suite can run in any
 * order without one test's attempts counting against another's.
 */
const LIMIT: Limit = { attempts: 3, windowSeconds: 60 };

let n = 0;
const freshKey = () => `test-${Date.now()}-${n++}@example.fr`;

afterAll(async () => {
  await db.authAttempt.deleteMany({ where: { key: { contains: '@example.fr' } } });
  await db.$disconnect();
});

describe('the rate limiter', () => {
  it('allows exactly the configured number of attempts, then refuses', async () => {
    const key = freshKey();

    for (let i = 1; i <= LIMIT.attempts; i++) {
      expect((await rateLimit('test', key, LIMIT)).allowed).toBe(true);
      await recordAttempt('test', key);
    }

    const refused = await rateLimit('test', key, LIMIT);
    expect(refused.allowed).toBe(false);
  });

  it('says how long to wait, and the delay is inside the window', async () => {
    const key = freshKey();
    for (let i = 0; i < LIMIT.attempts; i++) await recordAttempt('test', key);

    const refused = await rateLimit('test', key, LIMIT);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) return;

    expect(refused.retryAfter).toBeGreaterThan(0);
    expect(refused.retryAfter).toBeLessThanOrEqual(LIMIT.windowSeconds);
  });

  it('counts each key separately', async () => {
    // Otherwise one person hitting the limit would lock out everybody else,
    // which is a denial of service rather than a protection.
    const a = freshKey();
    const b = freshKey();

    for (let i = 0; i < LIMIT.attempts; i++) await recordAttempt('test', a);
    expect((await rateLimit('test', a, LIMIT)).allowed).toBe(false);

    expect((await rateLimit('test', b, LIMIT)).allowed).toBe(true);
  });

  it('keeps two actions on the same key in separate buckets', async () => {
    // A per-e-mail login limit and a per-IP one must not drain each other.
    const key = freshKey();
    for (let i = 0; i < LIMIT.attempts; i++) await recordAttempt('one', key);

    expect((await rateLimit('one', key, LIMIT)).allowed).toBe(false);
    expect((await rateLimit('two', key, LIMIT)).allowed).toBe(true);
  });

  it('treats an address as the same bucket whatever its case', async () => {
    const key = freshKey();
    for (let i = 0; i < LIMIT.attempts; i++) {
      await recordAttempt('test', key.toUpperCase());
    }
    // The allowance is already spent by the upper-cased form.
    const refused = await rateLimit('test', key.toLowerCase(), LIMIT);
    expect(refused.allowed).toBe(false);
  });

  it('never spends the allowance on an attempt that succeeded', async () => {
    // The reason check and record are separate. A household, an office or a
    // school shares one address; if every successful sign-in counted, they
    // would throttle each other simply by using the app.
    const key = freshKey();
    for (let i = 0; i < LIMIT.attempts * 3; i++) {
      expect((await rateLimit('login:ip', key, LIMIT)).allowed).toBe(true);
    }
  });

  it('forgets the failures that preceded a success', async () => {
    // Someone who mistypes twice and then signs in must not carry those
    // failures into their next sign-in.
    const key = freshKey();
    await recordAttempt('login:email', key);
    await recordAttempt('login:email', key);

    await clearAttempts('login:email', key);

    for (let i = 0; i < LIMIT.attempts; i++) {
      expect((await rateLimit('login:email', key, LIMIT)).allowed).toBe(true);
    }
  });

  it('ignores attempts that have fallen out of the window', async () => {
    // The window slides, so a limit is never permanent. Simulated by ageing
    // the rows rather than by waiting.
    const key = freshKey();
    for (let i = 0; i < LIMIT.attempts; i++) await recordAttempt('test', key);
    expect((await rateLimit('test', key, LIMIT)).allowed).toBe(false);

    await db.authAttempt.updateMany({
      where: { key: `test:${key.toLowerCase()}` },
      data: { createdAt: new Date(Date.now() - (LIMIT.windowSeconds + 60) * 1000) },
    });

    expect((await rateLimit('test', key, LIMIT)).allowed).toBe(true);
  });

  it('purges rows older than a day and keeps recent ones', async () => {
    const key = freshKey();
    await recordAttempt('test', key);
    await db.authAttempt.updateMany({
      where: { key: `test:${key.toLowerCase()}` },
      data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const recent = freshKey();
    await recordAttempt('test', recent);

    await purgeOldAttempts();

    expect(
      await db.authAttempt.count({ where: { key: `test:${key.toLowerCase()}` } }),
    ).toBe(0);
    expect(
      await db.authAttempt.count({ where: { key: `test:${recent.toLowerCase()}` } }),
    ).toBe(1);
  });
});

describe('the refusal message', () => {
  it('speaks in minutes, rounded up', () => {
    expect(retryMessage(30)).toContain('une minute');
    expect(retryMessage(61)).toContain('2 minutes');
    expect(retryMessage(15 * 60)).toContain('15 minutes');
  });
});
