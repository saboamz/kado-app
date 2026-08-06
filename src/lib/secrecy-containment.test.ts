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
 *  - reco.ts reads Reservation for ONE purpose: to drop products the viewer
 *    has already reserved themselves, which they obviously already know
 *    about. The query is scoped to `reserverId: viewerId` and nothing it
 *    returns reaches a response — only productIds entering an exclusion Set.
 *    Widening that scope to other people's reservations is THE leak the
 *    recommender must never reopen (see reco-invariance.test.ts), so this
 *    entry is the one to look at hardest if it ever changes.
 *
 * secrecy.ts itself is absent on purpose — it names the tables only in types
 * and in the Prisma `include`, never as a query.
 */
const ALLOWED = new Set([
  'src/lib/reservation-actions.ts',
  'src/lib/pot-actions.ts',
  'src/lib/reco.ts',
]);

/**
 * Matches a Prisma query against either secret table, on the `db` client or a
 * transaction handle (`tx.reservation.…`), which is how these rows will be
 * written once an event log puts the two in one transaction.
 */
const SECRET_QUERY = /\b(?:db|prisma|tx)\s*\.\s*(reservation|potContribution)\s*\./;

/**
 * The same reach, one level down: a secret table pulled in as a NESTED
 * relation.
 *
 * SECRET_QUERY only sees a query rooted at the client, so
 * `db.giftList.findMany({ include: { gifts: { select: { reservation: … } } } })`
 * slipped past it — which is precisely how the list index came to load an
 * owner's reservations and discard them afterwards. Every behavioural test
 * stayed green, because the rows never reached the response; the leak was that
 * they had been fetched at all, one careless spread away from it.
 *
 * So nesting is matched on its own terms, and gifts.ts is allowlisted for it
 * with the condition stated below and asserted further down.
 */
const NESTED_SECRET = /\b(reservation|contributions|potContribution)\s*:\s*\{/;

/**
 * gifts.ts may name `reservation` inside an include for ONE reason: the list
 * index counts reservations for a friend. It must do so through
 * listInclude(relation), which omits the whole gifts relation for an owner —
 * not by selecting the rows and dropping them later.
 *
 * secrecy.ts is here because giftInclude() is the canonical statement of that
 * rule; it names the tables in an include and nowhere else.
 */
const NESTED_ALLOWED = new Set(['src/lib/gifts.ts', 'src/lib/secrecy.ts']);

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

  it('keeps the recommenders reservation query scoped to the viewer', () => {
    // reco.ts is allowlisted only because its query is scoped to the viewer's
    // OWN reservations. An unscoped findMany there is the covert channel: the
    // list would encode who has reserved what, and an owner with a second
    // account could read it by difference over time.
    //
    // reco-invariance.test.ts catches that behaviourally; this catches it in
    // the shape, because a grep is cheap and the assertion above only says
    // "this file may touch the table", not "on these terms".
    const source = readFileSync('src/lib/reco.ts', 'utf8');
    const query = source.slice(
      source.indexOf('db.reservation.findMany'),
      source.indexOf('});', source.indexOf('db.reservation.findMany')),
    );
    expect(query).toContain('reserverId: viewerId');
  });

  it('is limited to the allowlist when the table is nested in an include', () => {
    const nested = sourceFiles('src')
      .filter((path) => NESTED_SECRET.test(readFileSync(path, 'utf8')))
      .map((path) => path.split(/[\\/]/).join('/'))
      .filter((path) => !NESTED_ALLOWED.has(path));

    expect(nested).toEqual([]);
  });

  it('would notice a secret table nested inside an include', () => {
    // Guards the guard, as above: a nesting pattern that matched nothing would
    // make the assertion before it vacuously green — which is the state this
    // whole pair was added to end.
    expect(
      NESTED_SECRET.test('gifts: { select: { reservation: { select: { id: true } } } }'),
    ).toBe(true);
    expect(NESTED_SECRET.test('include: { contributions: { select: {} } }')).toBe(true);
    expect(NESTED_SECRET.test('include: { owner: { select: { id: true } } }')).toBe(false);
  });

  it('keeps the list index from selecting reservations for an owner', () => {
    // gifts.ts holds the nested privilege only on the terms in the comment on
    // NESTED_ALLOWED: the gifts relation is selected for a friend and omitted
    // for an owner. A version that selected it unconditionally and filtered
    // afterwards would satisfy every behavioural test in list-secrecy.test.ts,
    // so the shape is asserted here.
    const source = readFileSync('src/lib/gifts.ts', 'utf8');
    const include = source.slice(
      source.indexOf('export function listInclude'),
      source.indexOf('export async function getListsForViewer'),
    );

    expect(include).toContain("relation === 'owner'");
    // The owner must be returned BEFORE the gifts relation carrying
    // `reservation` is ever added — that ordering is what makes the omission
    // structural rather than a filter applied afterwards. Anchored on the
    // reservation select itself, since `_count: { select: { gifts: true } }`
    // also contains the substring "gifts:" and is not the relation at issue.
    const reservationSelect = include.search(/gifts\s*:\s*\{\s*select\s*:\s*\{\s*reservation/);
    expect(reservationSelect).toBeGreaterThan(-1);
    expect(include.indexOf("relation === 'owner'")).toBeLessThan(reservationSelect);
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
