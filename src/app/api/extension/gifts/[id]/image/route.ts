import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { rateLimit, recordAttempt, UPLOAD_PER_USER } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/session';
import { storeUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

/**
 * The picture of a wish, sent by the extension as bytes.
 *
 * Used only when the server's own download failed: some image CDNs answer
 * nothing that is not a real browser, and the person's browser is exactly
 * what the extension has — it crops the picture out of the screen and sends
 * it here. The bytes go through storeUpload like any photo somebody picks
 * from their disk: same size cap, same magic-byte check, same normalisation.
 *
 * Scoped to a wish that still has no picture, so a slower request never
 * replaces one that arrived meanwhile.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'signed-out' }, { status: 401 });

  const { id } = await params;
  const gift = await db.gift.findUnique({
    where: { id },
    select: { id: true, listId: true, imageUrl: true, list: { select: { ownerId: true } } },
  });
  // Not yours and not there look the same, as everywhere else.
  if (!gift || gift.list.ownerId !== user.id) {
    return NextResponse.json({ error: 'unknown-gift' }, { status: 404 });
  }
  if (gift.imageUrl) return NextResponse.json({ stored: false });

  const budget = await rateLimit('upload', user.id, UPLOAD_PER_USER);
  if (!budget.allowed) return NextResponse.json({ error: 'too-many-uploads' }, { status: 429 });
  await recordAttempt('upload', user.id);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('image');
  } catch {
    return NextResponse.json({ error: 'invalid-form' }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'no-image' }, { status: 400 });
  }

  const stored = await storeUpload(file, 'gifts');
  if (!stored.ok) return NextResponse.json({ error: 'bad-image' }, { status: 400 });

  const claimed = await db.gift.updateMany({
    where: { id: gift.id, imageUrl: null },
    data: { imageUrl: stored.path },
  });
  revalidatePath(`/lists/${gift.listId}`);
  revalidatePath(`/gifts/${gift.id}`);
  return NextResponse.json({ stored: claimed.count === 1 });
}
