import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Renseignez votre adresse e-mail.')
  .email('Cette adresse e-mail semble invalide.');

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(200, 'Le mot de passe est trop long.');

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Renseignez votre nom.')
    .max(80, 'Ce nom est trop long.'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Renseignez votre mot de passe.'),
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
    .min(1, 'Donnez un nom à votre liste.')
    .max(60, 'Ce nom est trop long.'),
  occasion: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(60, 'Ce texte est trop long.')),
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
    .pipe(z.string().max(max, 'Ce texte est trop long.'));

export const giftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Donnez un nom à cette envie.')
    .max(140, 'Ce nom est trop long.'),
  description: optionalText(1000),
  price: optionalText(40),
  url: optionalText(2000).refine(
    (v) => !v || /^https?:\/\/.+/.test(v) || /^[\w-]+(\.[\w-]+)+/.test(v),
    'Ce lien semble invalide.',
  ),
  merchant: optionalText(80),
  category: optionalText(40),
  priority: z.coerce.number().int().min(1).max(3),
  isPot: z.coerce.boolean().optional(),
});

export type GiftInput = z.infer<typeof giftSchema>;
export type ListInput = z.infer<typeof listSchema>;
