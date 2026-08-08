'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireUser } from './session';

export type InviteResult = { error?: string };

/**
 * The invitation link, and what happens when somebody follows it.
 *
 * ── Why the code is random rather than derived ─────────────────────────────
 *
 * A code built from the owner's id would be guessable, and a guessable code
 * means anyone can befriend anyone by enumeration — which in this app means
 * reading their lists. 9 bytes of randomness, base64url, is 72 bits: not
 * something you find by trying.
 */
const CODE_BYTES = 9;

function newCode(): string {
  return randomBytes(CODE_BYTES).toString('base64url');
}

/**
 * Returns the caller's active invitation, creating one on first use.
 *
 * One standing link per person rather than one per guest: the point is to
 * paste a single link into a family group chat, and generating a token per
 * recipient is exactly the friction this removes.
 */
export async function getOrCreateInvite() {
  const user = await requireUser();

  const existing = await db.invite.findFirst({
    where: { ownerId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  return db.invite.create({ data: { code: newCode(), ownerId: user.id } });
}

/**
 * Turns off the current link and issues a new one.
 *
 * The old code is revoked rather than deleted: somebody arriving on a stale
 * link needs to be told the invitation is closed, not shown a 404 that reads
 * like the app is broken.
 */
export async function rotateInvite(): Promise<InviteResult> {
  const user = await requireUser();

  await db.invite.updateMany({
    where: { ownerId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await db.invite.create({ data: { code: newCode(), ownerId: user.id } });

  revalidatePath('/friends');
  return {};
}

export type InviteView =
  | { state: 'invalid' }
  | { state: 'revoked'; owner: { name: string; avatarUrl: string | null } }
  | { state: 'self'; owner: { name: string; avatarUrl: string | null } }
  | { state: 'already'; owner: { name: string; avatarUrl: string | null } }
  | { state: 'open'; owner: { name: string; avatarUrl: string | null } };

/**
 * What an arriving visitor should be shown, without acting on anything.
 *
 * Deliberately readable while signed out: the landing page has to say WHO is
 * inviting you before you decide to sign up, and a name and photo are already
 * public to anybody they befriend.
 */
export async function readInvite(
  code: string,
  viewerId: string | null,
): Promise<InviteView> {
  const invite = await db.invite.findUnique({
    where: { code },
    select: {
      ownerId: true,
      revokedAt: true,
      owner: { select: { name: true, avatarUrl: true } },
    },
  });
  if (!invite) return { state: 'invalid' };

  const owner = invite.owner;
  if (invite.revokedAt) return { state: 'revoked', owner };
  if (viewerId && viewerId === invite.ownerId) return { state: 'self', owner };

  if (viewerId) {
    const friendship = await db.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: viewerId, addresseeId: invite.ownerId },
          { requesterId: invite.ownerId, addresseeId: viewerId },
        ],
      },
      select: { id: true },
    });
    if (friendship) return { state: 'already', owner };
  }

  return { state: 'open', owner };
}

/**
 * Accepts an invitation, creating the friendship outright.
 *
 * ── Why ACCEPTED and not PENDING ───────────────────────────────────────────
 *
 * The owner published this link themselves; following it is them saying yes
 * in advance. Making the invitee wait for a second confirmation would put
 * back the step the link exists to remove.
 *
 * ── The bit that needs care ────────────────────────────────────────────────
 *
 * Friendship is symmetric in meaning but directional in storage, and its
 * unique index is on (requesterId, addresseeId). A pending request already
 * sent the other way must therefore be UPDATED, not inserted alongside — two
 * rows for one relationship is how a friendship ends up half-accepted.
 */
export async function acceptInvite(code: string): Promise<InviteResult> {
  const user = await requireUser();

  const invite = await db.invite.findUnique({
    where: { code },
    select: { id: true, ownerId: true, revokedAt: true },
  });
  if (!invite) return { error: 'error.inviteUnknown' };
  if (invite.revokedAt) return { error: 'error.inviteClosed' };
  if (invite.ownerId === user.id) {
    return { error: 'error.ownInviteLink' };
  }

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: invite.ownerId },
        { requesterId: invite.ownerId, addresseeId: user.id },
      ],
    },
  });

  if (existing?.status === 'BLOCKED') {
    // Says nothing about why: a blocked person learning they are blocked is
    // information the blocker did not choose to give.
    return { error: 'error.tryLater' };
  }

  if (existing) {
    // Already friends is a success, not an error — they followed a link and
    // ended up where it promised.
    if (existing.status !== 'ACCEPTED') {
      await db.friendship.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED' },
      });
      await countUse(invite.id, invite.ownerId, user.name);
    }
  } else {
    await db.friendship.create({
      data: {
        requesterId: invite.ownerId,
        addresseeId: user.id,
        status: 'ACCEPTED',
      },
    });
    await countUse(invite.id, invite.ownerId, user.name);
  }

  revalidatePath('/friends');
  revalidatePath('/app');
  return {};
}

/** Records the use and tells the owner somebody arrived. */
async function countUse(inviteId: string, ownerId: string, name: string) {
  await db.$transaction([
    db.invite.update({
      where: { id: inviteId },
      data: { uses: { increment: 1 } },
    }),
    db.notification.create({
      data: {
        userId: ownerId,
        type: 'FRIEND_ACCEPTED',
        body: `${name} a rejoint Kado grâce à votre invitation.`,
        href: '/friends',
      },
    }),
  ]);
}
