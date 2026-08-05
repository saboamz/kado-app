import { readFileSync } from 'node:fs';

/**
 * That the server actions actually CARRY the rules the other tests prove.
 *
 * This file exists because of a hole I found by sabotage. event-integrity.test.ts
 * replays releaseGift's guard rather than calling it — the actions need a
 * request context, so the rule is exercised on a copy. Removing the guard from
 * the real releaseGift left all 313 tests green: they proved the rule works,
 * never that it is applied.
 *
 * These assertions are structural, which is weak, and they are deliberately
 * narrow: each one names one invariant that a sabotage of the production file
 * must break. When the actions become callable under test, replace this with
 * behavioural tests — a grep is a stand-in for coverage, not coverage.
 */

const read = (path: string) => readFileSync(path, 'utf8');

const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start);
  if (from === -1) return '';
  const to = text.indexOf(end, from + start.length);
  return text.slice(from, to === -1 ? undefined : to);
};

describe('reservation-actions carries its event rules', () => {
  const source = () => read('src/lib/reservation-actions.ts');

  it('writes the reserve event inside the reservation transaction', () => {
    const body = between(source(), 'export async function reserveGift', '\nexport ');
    expect(body).toContain('$transaction');
    expect(body).toContain("kind: 'reserve'");
    // The event and the row it describes must commit or roll back together.
    expect(body.indexOf('$transaction')).toBeLessThan(body.indexOf('logEvent'));
  });

  it('guards the unreserve event on something actually being released', () => {
    const body = between(source(), 'export async function releaseGift', '\n}');

    // THE assertion this file was written for. Without the count check, anyone
    // could bury any product by looping releases of gifts they never held.
    expect(body).toMatch(/if \(deleted\.count > 0\)/);

    // And the guard must come BEFORE the event, not merely exist somewhere.
    const guard = body.search(/if \(deleted\.count > 0\)/);
    const event = body.indexOf("kind: 'unreserve'");
    expect(guard).toBeGreaterThan(-1);
    expect(event).toBeGreaterThan(guard);
  });

  it('takes the actor from the session in both actions', () => {
    const text = source();
    // user comes from requireUser(); an actorId read off a parameter would let
    // one account attribute events to anybody.
    expect(text).toContain('requireUser');
    expect(text).toMatch(/actorId: user\.id/);
    expect(text).not.toMatch(/actorId: (input|params|data)\./);
  });
});

describe('pot-actions carries its event rules', () => {
  it('writes the contribute event inside the contribution transaction', () => {
    const body = between(read('src/lib/pot-actions.ts'), 'export async function contribute', '\nexport ');
    expect(body).toContain('$transaction');
    expect(body).toContain("kind: 'contribute'");
    expect(body).toMatch(/actorId: user\.id/);
  });
});

describe('gift-actions carries its event rules', () => {
  it('logs add_wish against the adder, with no recipient', () => {
    const body = between(read('src/lib/gift-actions.ts'), 'export async function createGift', '\nexport ');
    expect(body).toContain("kind: 'add_wish'");
    // add_wish is evidence about the person who added it. A recipientId here
    // would file it as a gifting event and train the model on the wrong axis.
    //
    // Matches the FIELD, not the word: the first version of this assertion was
    // a bare toContain('recipientId') and it failed on the comment above the
    // call, which is a grep reading prose rather than code.
    expect(body).not.toMatch(/^\s*recipientId:/m);
  });
});

describe('these assertions can actually fail', () => {
  // Guards the guard: `between` returning '' would make every toContain above
  // fail loudly, but a toContain on an empty string that happened to be
  // asserted with .not would pass vacuously. This pins the helper's behaviour.
  it('extracts a real function body', () => {
    const body = between(read('src/lib/reservation-actions.ts'), 'export async function releaseGift', '\n}');
    expect(body.length).toBeGreaterThan(200);
    expect(body).toContain('releaseGift');
  });

  it('returns empty for a function that is not there', () => {
    expect(between(read('src/lib/reservation-actions.ts'), 'export async function nope', '\n}')).toBe('');
  });
});
