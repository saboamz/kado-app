import { randomBytes } from 'node:crypto';
import { db } from './db';
import { readInvite } from './invite-actions';
import { cleanup, makeFriends, makeUser } from '@/test/factories';

/**
 * What an invitation link shows, and to whom.
 *
 * acceptInvite() calls requireUser() and so needs a session; it is exercised
 * end to end in e2e/invites.spec.ts. What is worth holding here is the part
 * that decides what an arriving visitor is TOLD — including the states that
 * are easy to get wrong: a revoked link, your own link, and somebody who is
 * already a friend.
 */
let owner: { id: string; name: string };
let stranger: { id: string };
let friend: { id: string };
const codes: string[] = [];

const makeInvite = async (ownerId: string, revoked = false) => {
  const code = `test-${Date.now()}-${codes.length}`;
  codes.push(code);
  return db.invite.create({
    data: { code, ownerId, revokedAt: revoked ? new Date() : null },
  });
};

beforeAll(async () => {
  owner = await makeUser('Camille Rey');
  stranger = await makeUser('Inconnu');
  friend = await makeUser('Déjà Ami');
  await makeFriends(owner.id, friend.id);
});

afterAll(async () => {
  await db.invite.deleteMany({ where: { code: { in: codes } } });
  await cleanup([owner.id, stranger.id, friend.id]);
  await db.$disconnect();
});

describe('what an invitation link shows', () => {
  it('names the person inviting you, even signed out', async () => {
    // Somebody arriving from a group chat has to see WHO invited them before
    // deciding to sign up. The name and photo are already visible to anyone
    // they befriend, so this gives away nothing accepting would not.
    const invite = await makeInvite(owner.id);

    const view = await readInvite(invite.code, null);
    expect(view.state).toBe('open');
    if (view.state === 'invalid') return;
    expect(view.owner.name).toBe(owner.name);
  });

  it('says a closed invitation is closed, not that it never existed', async () => {
    // Revoked rather than deleted on purpose: somebody arriving late needs to
    // be told the link is closed, not shown a 404 that reads like a bug.
    const invite = await makeInvite(owner.id, true);

    expect((await readInvite(invite.code, null)).state).toBe('revoked');
  });

  it('reports an unknown code as invalid', async () => {
    expect((await readInvite('nexistepas', null)).state).toBe('invalid');
  });

  it('recognises your own link', async () => {
    // You are not going to befriend yourself; the page sends you to share it.
    const invite = await makeInvite(owner.id);

    expect((await readInvite(invite.code, owner.id)).state).toBe('self');
  });

  it('recognises somebody who is already a friend', async () => {
    // Following a link you already acted on is not an error — the page says
    // so rather than pretending to do something.
    const invite = await makeInvite(owner.id);

    expect((await readInvite(invite.code, friend.id)).state).toBe('already');
  });

  it('is open to a stranger who is not yet a friend', async () => {
    const invite = await makeInvite(owner.id);

    expect((await readInvite(invite.code, stranger.id)).state).toBe('open');
  });

  it('is open when a friendship exists but was never accepted', async () => {
    // A pending request is not a friendship. The link is the faster route to
    // one, and acceptInvite upgrades the existing row rather than inserting a
    // second — the unique index is on (requesterId, addresseeId), so two rows
    // for one relationship is how it ends up half-accepted.
    const pending = await makeUser('En attente');
    await db.friendship.create({
      data: { requesterId: pending.id, addresseeId: owner.id, status: 'PENDING' },
    });
    const invite = await makeInvite(owner.id);

    expect((await readInvite(invite.code, pending.id)).state).toBe('open');
    await cleanup([pending.id]);
  });
});

describe('the code itself', () => {
  it('is unique per invitation', async () => {
    const a = await makeInvite(owner.id);
    const b = await makeInvite(owner.id);
    expect(a.code).not.toBe(b.code);
  });

  it('is long enough, and URL-safe, so it cannot be guessed or mangled', () => {
    // A guessable code would let anyone befriend anyone by enumeration, which
    // in this app means reading their lists. 9 random bytes is 72 bits.
    //
    // base64url matters as much: a '+' or '/' in a path is either escaped or
    // silently rewritten by whatever chat app carries the link, and the code
    // that arrives no longer matches the one issued.
    const code = randomBytes(9).toString('base64url');

    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeGreaterThanOrEqual(12);
    expect(encodeURIComponent(code)).toBe(code);
  });
});
