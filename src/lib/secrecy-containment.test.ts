import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Containment: which files are allowed to touch the two secret tables.
 *
 * The redaction in secrecy.ts is only worth anything if every read of
 * Reservation / PotContribution goes through it. A new route that calls
 * `db.reservation.findMany()` and spreads the row into its response would leak
 * the secret without touching a single line covered by the other tests — they
 * would all still be green.
 *
 * So this test does not check behaviour, it checks reach: grep the source, and
 * fail if a file outside the allowlist queries either table. A new call site is
 * not necessarily a bug, but it must be a decision somebody made on purpose,
 * which is what having to edit this list forces.
 */

/**
 * Why each of these is allowed to hold the privilege:
 *
 *  - reservation-actions.ts / pot-actions.ts are the *writers*. They create and
 *    delete rows on behalf of the acting user, and both refuse outright when
 *    `relationTo(...) === 'owner'`. They never return a row to a caller: the
 *    reads they do are scoped to the caller's own id (releaseGift,
 *    withdrawContribution) or aggregate-only with the figure kept server-side
 *    and never put in the response (the pot's remaining-amount cap).
 *
 * secrecy.ts itself is absent on purpose — it names the tables only in types
 * and in the Prisma `include`, never as a query.
 */
const ALLOWED = new Set(['src/lib/reservation-actions.ts', 'src/lib/pot-actions.ts']);

/**
 * Matches a Prisma query against either secret table, on the `db` client or a
 * transaction handle (`tx.reservation.…`), which is how these rows will be
 * written once an event log puts the two in one transaction.
 */
const SECRET_QUERY = /\b(?:db|prisma|tx)\s*\.\s*(reservation|potContribution)\s*\./;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe('reach of the secret tables', () => {
  const offenders = sourceFiles('src')
    .filter((path) => SECRET_QUERY.test(readFileSync(path, 'utf8')))
    .map((path) => path.split(/[\\/]/).join('/'))
    .filter((path) => !ALLOWED.has(path));

  it('is limited to the files that are allowed to have it', () => {
    expect(offenders).toEqual([]);
  });

  it('would notice a new file that queried them', () => {
    // Guards the guard. A regex that matched nothing would make the assertion
    // above pass forever, silently — the inert-reporter failure, where the
    // check cannot fail and so proves nothing. This asserts it still bites.
    expect(SECRET_QUERY.test('const r = await db.reservation.findMany();')).toBe(true);
    expect(SECRET_QUERY.test('await tx.potContribution.aggregate({});')).toBe(true);
    expect(SECRET_QUERY.test('const g = await db.gift.findMany();')).toBe(false);
  });

  it('actually scanned the source tree', () => {
    // A typo in the walk (wrong root, over-eager filter) would yield an empty
    // file list, and an empty list has no offenders — vacuously green.
    const scanned = sourceFiles('src');
    expect(scanned.length).toBeGreaterThan(40);
    expect(scanned).toContain('src/lib/secrecy.ts');
  });

  it('has an allowlist that is still real', () => {
    // A stale allowlist entry (file renamed or its query removed) would sit
    // here granting a privilege nobody uses, and would quietly re-permit the
    // path if the name were ever reused.
    for (const allowed of ALLOWED) {
      expect(SECRET_QUERY.test(readFileSync(allowed, 'utf8'))).toBe(true);
    }
  });
});
