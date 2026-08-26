/**
 * The comparable form of a username.
 *
 * A name is shown as written — "Sophie Marchand" — but two people cannot
 * hold the same one once it is compared: case-folded, trimmed, inner spaces
 * collapsed. That is the whole rule, and it is deliberately small enough to
 * be written twice: here, before every write, and in SQL inside the
 * migration that backfilled existing accounts
 * (lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))). The two must agree,
 * or a name written before the column existed would never match the same
 * name typed into the search box after.
 *
 * Accents are NOT folded: Postgres cannot do it without an extension, and a
 * rule the migration cannot mirror is a rule that lies about old rows.
 */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
