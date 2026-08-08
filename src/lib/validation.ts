import { z } from 'zod';
import { isCategory } from './taxonomy';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'error.emailRequired')
  .email('error.emailInvalid');

export const passwordSchema = z
  .string()
  .min(8, 'error.passwordShort')
  .max(200, 'error.passwordLong');

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'error.nameRequired')
    .max(80, 'error.nameLong'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'error.passwordRequired'),
});

/** Turns a ZodError into `{ field: message }` for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}

export const listSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'error.listNameRequired')
    .max(60, 'error.nameLong'),
  occasion: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(60, 'error.textLong')),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']),
});

/**
 * A wish needs a name and nothing else.
 *
 * Everything else is optional on purpose: "un week-end en Islande" is a
 * legitimate wish with no price, no link and no shop.
 */
/**
 * A wish needs a name and nothing else.
 *
 * Everything else is optional on purpose: "un week-end en Islande" is a
 * legitimate wish with no price, no link and no shop.
 *
 * `optionalText` accepts a missing field, an empty string, or text, and
 * always yields a string. A bare `.optional()` would reject the `null` that
 * FormData produces for an input the form does not render at all.
 */
const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(max, 'error.textLong'));

export const giftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'error.giftNameRequired')
    .max(140, 'error.nameLong'),
  description: optionalText(1000),
  price: optionalText(40),
  url: optionalText(2000).refine(
    (v) => !v || /^https?:\/\/.+/.test(v) || /^[\w-]+(\.[\w-]+)+/.test(v),
    'Ce lien semble invalide.',
  ),
  merchant: optionalText(80),
  /*
   * A closed list, not free text.
   *
   * The recommender's content_facet tier matches on this value, so every
   * alternative spelling — "Tech", "tech", "High-tech" — is a bucket nobody
   * else falls into, and the tier quietly finds less as the catalogue grows.
   * Refusing anything off the list is what keeps the data usable later.
   *
   * Still optional: a wish can legitimately be "un week-end en Islande" with
   * no obvious category, and forcing a choice would push people into picking
   * one at random, which is worse than none at all.
   */
  category: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || isCategory(v), 'error.categoryRequired'),
  priority: z.coerce.number().int().min(1).max(3),
});

export type GiftInput = z.infer<typeof giftSchema>;
export type ListInput = z.infer<typeof listSchema>;
