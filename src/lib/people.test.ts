import { db } from './db';
import { getFriendGroups, searchPeople } from './people';
import { cleanup, makeFriends, makeUser } from '@/test/factories';

describe('searching for people', () => {
  let viewer: { id: string };
  let alice: { id: string; email: string };
  let bob: { id: string };
  const ids: string[] = [];

  beforeAll(async () => {
    viewer = await makeUser('Viewer Zaphod');
    alice = await makeUser('Alice Zaphod');
    bob = await makeUser('Bob Zaphod');
    ids.push(viewer.id, alice.id, bob.id);
  });

  afterAll(async () => {
    await cleanup(ids);
    await db.$disconnect();
  });

  it('finds people by partial name, case-insensitively', async () => {
    const results = await searchPeople('alice zap', viewer.id);
    expect(results.map((r) => r.id)).toContain(alice.id);
  });

  it('never returns the searcher themselves', async () => {
    const results = await searchPeople('Zaphod', viewer.id);
    expect(results.map((r) => r.id)).not.toContain(viewer.id);
  });

  it('finds a person by their exact e-mail', async () => {
    const results = await searchPeople(alice.email, viewer.id);
    expect(results.map((r) => r.id)).toEqual([alice.id]);
  });

  it('refuses to match a partial e-mail', async () => {
    // Prefix matching would let anyone enumerate addresses, the same leak the
    // login page is careful to avoid.
    const prefix = alice.email.slice(0, 8);
    const results = await searchPeople(prefix, viewer.id);
    expect(results.map((r) => r.id)).not.toContain(alice.id);
  });

  it('ignores a query too short to be meaningful', async () => {
    expect(await searchPeople('a', viewer.id)).toEqual([]);
    expect(await searchPeople('  ', viewer.id)).toEqual([]);
  });

  it('reports how the searcher relates to each result', async () => {
    await makeFriends(viewer.id, alice.id);
    const results = await searchPeople('Zaphod', viewer.id);

    expect(results.find((r) => r.id === alice.id)?.relation).toBe('friend');
    expect(results.find((r) => r.id === bob.id)?.relation).toBe('none');
  });
});

describe('friend groups', () => {
  let viewer: { id: string };
  let friend: { id: string };
  let asked: { id: string };
  let asking: { id: string };
  const ids: string[] = [];

  beforeAll(async () => {
    viewer = await makeUser('Viewer');
    friend = await makeUser('Friend');
    asked = await makeUser('Asked');
    asking = await makeUser('Asking');
    ids.push(viewer.id, friend.id, asked.id, asking.id);

    await makeFriends(viewer.id, friend.id);
    await db.friendship.create({
      data: { requesterId: viewer.id, addresseeId: asked.id, status: 'PENDING' },
    });
    await db.friendship.create({
      data: {
        requesterId: asking.id,
        addresseeId: viewer.id,
        status: 'PENDING',
      },
    });
  });

  afterAll(async () => {
    await cleanup(ids);
    await db.$disconnect();
  });

  it('separates friends, requests received and requests sent', async () => {
    const groups = await getFriendGroups(viewer.id);

    expect(groups.friends.map((p) => p.id)).toEqual([friend.id]);
    expect(groups.received.map((p) => p.id)).toEqual([asking.id]);
    expect(groups.sent.map((p) => p.id)).toEqual([asked.id]);
  });

  it('describes the other person, never the viewer', async () => {
    const groups = await getFriendGroups(viewer.id);
    const everyone = [...groups.friends, ...groups.received, ...groups.sent];
    expect(everyone.map((p) => p.id)).not.toContain(viewer.id);
  });

  it('carries the friendship id so a request can be acted on', async () => {
    const groups = await getFriendGroups(viewer.id);
    expect(groups.received[0]!.friendshipId).toBeTruthy();
  });
});
