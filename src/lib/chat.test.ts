import { getChatForViewer } from './chat';
import { db } from './db';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeUser,
} from '@/test/factories';

describe('the secret chat', () => {
  let owner: { id: string };
  let alice: { id: string };
  let bob: { id: string };
  let stranger: { id: string };
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    bob = await makeUser('Bob');
    stranger = await makeUser('Stranger');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, bob.id);

    const list = await makeList(owner.id);
    giftId = (await makeGift(list.id)).id;

    await db.chatMessage.create({
      data: { giftId, authorId: alice.id, body: 'Je mets 50 €.' },
    });
    await db.chatMessage.create({
      data: { giftId, authorId: bob.id, body: 'Je complète le reste.' },
    });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id, bob.id, stranger.id]);
    await db.$disconnect();
  });

  it('shows friends the whole conversation', async () => {
    const messages = await getChatForViewer(giftId, alice.id);
    expect(messages).toHaveLength(2);
    expect(messages!.map((m) => m.body)).toEqual([
      'Je mets 50 €.',
      'Je complète le reste.',
    ]);
  });

  it('marks which messages are the reader’s own', async () => {
    const messages = await getChatForViewer(giftId, alice.id);
    expect(messages!.find((m) => m.body.startsWith('Je mets'))!.mine).toBe(true);
    expect(messages!.find((m) => m.body.startsWith('Je complète'))!.mine).toBe(
      false,
    );
  });

  /**
   * The chat is the most damaging thing in the app for an owner to read: it
   * is where the surprise is spelled out in words.
   */
  it('gives the owner nothing at all, not even an empty room', async () => {
    // null, not []: the owner cannot tell an empty chat from a forbidden one.
    expect(await getChatForViewer(giftId, owner.id)).toBeNull();
  });

  it('gives a stranger nothing either', async () => {
    expect(await getChatForViewer(giftId, stranger.id)).toBeNull();
  });

  it('never leaks a message body to the owner', async () => {
    const result = await getChatForViewer(giftId, owner.id);
    expect(JSON.stringify(result)).not.toContain('Je mets');
    expect(JSON.stringify(result)).not.toContain(alice.id);
  });

  it('returns null for a gift that does not exist', async () => {
    expect(await getChatForViewer('missing', alice.id)).toBeNull();
  });

  it('orders messages oldest first', async () => {
    const messages = await getChatForViewer(giftId, bob.id);
    const times = messages!.map((m) => new Date(m.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('vanishes with the gift', async () => {
    const list = await makeList(owner.id);
    const doomed = await makeGift(list.id);
    await db.chatMessage.create({
      data: { giftId: doomed.id, authorId: alice.id, body: 'Éphémère' },
    });

    await db.gift.delete({ where: { id: doomed.id } });
    expect(
      await db.chatMessage.count({ where: { giftId: doomed.id } }),
    ).toBe(0);
  });
});
