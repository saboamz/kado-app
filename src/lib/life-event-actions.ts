'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireUser } from './session';
import { eventSchema, fieldErrors } from './validation';

export type FormState = { errors?: Record<string, string> };

/**
 * Dates people choose to publish about themselves.
 *
 * This replaced a single `birthday` column, which decided for everybody which
 * date mattered and what it was called. Here the label is free text and the
 * visibility is per event, so somebody can publish a wedding to their friends,
 * nothing at all, or three dates the app has no name for.
 */
const MAX_EVENTS = 12;

function read(formData: FormData) {
  return eventSchema.safeParse({
    label: formData.get('label'),
    day: formData.get('day'),
    month: formData.get('month'),
    visibility: formData.get('visibility') ?? 'FRIENDS',
  });
}

export async function createLifeEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = read(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // A ceiling rather than a rule about what counts as an event: the profile
  // is a page somebody reads, and a hundred dates is not one.
  const count = await db.lifeEvent.count({ where: { ownerId: user.id } });
  if (count >= MAX_EVENTS) return { errors: { label: 'error.eventTooMany' } };

  await db.lifeEvent.create({
    data: { ...parsed.data, ownerId: user.id },
  });

  revalidatePath('/profile');
  revalidatePath('/profile/edit');
  revalidatePath('/events');
  revalidatePath(`/u/${user.id}`);
  return {};
}

export async function updateLifeEvent(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = read(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Ownership lives in the WHERE clause, so it cannot race a check made
  // beforehand and cannot be bypassed by a crafted id.
  const { count } = await db.lifeEvent.updateMany({
    where: { id, ownerId: user.id },
    data: parsed.data,
  });
  if (count === 0) return { errors: { label: 'error.eventNotFound' } };

  revalidatePath('/profile');
  revalidatePath('/profile/edit');
  revalidatePath('/events');
  revalidatePath(`/u/${user.id}`);
  return {};
}

export async function deleteLifeEvent(id: string): Promise<FormState> {
  const user = await requireUser();

  const { count } = await db.lifeEvent.deleteMany({
    where: { id, ownerId: user.id },
  });
  if (count === 0) return { errors: { label: 'error.eventNotFound' } };

  revalidatePath('/profile');
  revalidatePath('/profile/edit');
  revalidatePath('/events');
  revalidatePath(`/u/${user.id}`);
  return {};
}
