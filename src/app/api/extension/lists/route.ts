import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The signed-in person's lists, for the extension's picker.
 *
 * Authentication rides on the ordinary session cookie: Chrome sends it with
 * an extension's requests once the extension holds host permission for this
 * origin — that exemption from SameSite is the whole reason no token system
 * exists here. A browser tab from another site never gets this far: the
 * cookie is SameSite=Strict, so a cross-site caller arrives signed out and
 * receives the 401.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'signed-out' }, { status: 401 });

  const lists = await db.giftList.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ lists });
}
