/**
 * The bridge between what people SAY they like and how products are filed.
 *
 * content_facet matched Interest.label against Product.categoryId with strict
 * equality, and the two vocabularies had NO overlap at all: interests read
 * "Café", "Céramique", "Randonnée"; categories read "Maison", "Sport", "Tech",
 * "Voyage". The tier that is supposed to carry the traffic at launch could
 * therefore never match anything, and it failed silently — an empty tier looks
 * exactly like a tier with nothing to suggest.
 *
 * This is a mapping table rather than anything cleverer on purpose: it is
 * inspectable, it is French (the product contract), and a wrong row is fixed
 * by editing one line. Categories are the coarse buckets products are filed
 * under; interests are the fine-grained things people actually declare.
 */

/**
 * Canonical product categories. The closed list — nothing else is accepted.
 *
 * ── Why a fixed list, and why this one ─────────────────────────────────────
 *
 * The field used to be free text. Two people filing the same kind of thing
 * would write "Tech", "tech" and "High-tech", and the recommender's
 * content_facet tier matches on this value: every spelling is a bucket nobody
 * else falls into, so the tier finds less and less as the catalogue grows,
 * silently. A closed list is what makes the data worth keeping.
 *
 * The original eight are all still here, in their original spelling, so
 * nothing already stored becomes invalid. The rest fill the gaps that forced
 * people into "Maison" for a plant, a drill and a board game alike.
 *
 * Order is deliberate: related things sit together, so the dropdown reads as
 * groups rather than as an alphabetical wall. "Autre" is last and is the
 * escape hatch — without one, anything unclassifiable gets filed under
 * whatever happens to be first, which is worse than an honest "Autre".
 */
export const CATEGORIES = [
  'Maison',
  'Jardin',
  'Bricolage',
  'Tech',
  'Jeux',
  'Sport',
  'Bien-être',
  'Beauté',
  'Mode',
  'Bijoux',
  'Culture',
  'Papeterie',
  'Gourmandise',
  'Voyage',
  'Enfants',
  'Animaux',
  'Autre',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Which categories an interest points at.
 *
 * One interest can span several: "Café" is both a kitchen object and a
 * consumable, and someone who says it may want either.
 */
const INTEREST_TO_CATEGORIES: Record<string, Category[]> = {
  café: ['Gourmandise', 'Maison'],
  thé: ['Gourmandise', 'Maison'],
  cuisine: ['Maison', 'Gourmandise'],
  pâtisserie: ['Gourmandise', 'Maison'],
  céramique: ['Maison'],
  poterie: ['Maison'],
  design: ['Maison', 'Mode'],
  décoration: ['Maison'],
  jardinage: ['Jardin'],
  plantes: ['Jardin', 'Maison'],
  potager: ['Jardin'],
  bricolage: ['Bricolage'],
  menuiserie: ['Bricolage'],
  randonnée: ['Sport', 'Voyage'],
  course: ['Sport'],
  running: ['Sport'],
  vélo: ['Sport'],
  cyclisme: ['Sport'],
  escalade: ['Sport'],
  yoga: ['Sport', 'Bien-être'],
  natation: ['Sport'],
  ski: ['Sport', 'Voyage'],
  football: ['Sport'],
  lecture: ['Culture'],
  livres: ['Culture'],
  cinéma: ['Culture'],
  photographie: ['Culture', 'Tech'],
  'jeux vidéo': ['Jeux', 'Tech'],
  'jeux de société': ['Jeux'],
  puzzle: ['Jeux'],
  informatique: ['Tech'],
  voyage: ['Voyage'],
  camping: ['Voyage', 'Sport'],
  mode: ['Mode'],
  bijoux: ['Bijoux', 'Mode'],
  montres: ['Bijoux'],
  parfum: ['Beauté', 'Bien-être'],
  maquillage: ['Beauté'],
  'soins du visage': ['Beauté', 'Bien-être'],
  méditation: ['Bien-être'],
  écriture: ['Papeterie', 'Culture'],
  papeterie: ['Papeterie'],
  calligraphie: ['Papeterie'],
  dessin: ['Papeterie', 'Culture'],
  chats: ['Animaux'],
  chiens: ['Animaux'],
  animaux: ['Animaux'],
  enfants: ['Enfants'],
  bébé: ['Enfants'],
};

/**
 * What the sign-up questionnaire offers, as a grid to tick.
 *
 * The categories themselves rather than the fine-grained interests below
 * them. Thirty-six checkboxes was a form people abandon, and the extra
 * precision bought nothing: content_facet filters products by category, so
 * "Café" and "Gourmandise" reach the same shelf. Somebody who wants to be
 * more specific can still write it in their profile, where interests are free
 * text and the mapping table does its work.
 *
 * "Autre" is left out. It is the escape hatch for filing a product nobody can
 * classify; as a statement of taste it means nothing, and it would match
 * everything filed there for want of anywhere better.
 */
export const SURVEY_CATEGORIES = CATEGORIES.filter((c) => c !== 'Autre');

/**
 * Normalises a label for lookup: case-folded, de-accented, whitespace
 * collapsed.
 *
 * Users type "Café", "CAFE" and "cafe"; the table cannot hold every spelling,
 * and a lookup that missed on an accent would silently drop that person's
 * whole interest.
 */
export function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The categories themselves, reachable by the same folded lookup. */
const CATEGORY_BY_NORMALIZED: Map<string, Category> = new Map(
  CATEGORIES.map((c) => [normalizeLabel(c), c]),
);

/** Lookup table keyed by the normalised form, built once. */
const NORMALIZED: Map<string, Category[]> = new Map(
  Object.entries(INTEREST_TO_CATEGORIES).map(([k, v]) => [normalizeLabel(k), v]),
);

/**
 * The categories one declared interest maps to.
 *
 * An interest nobody mapped yet returns []. That is deliberate: inventing a
 * category for an unknown word would file products under a guess, and a wrong
 * recommendation is worse than none. Unmapped interests are visible through
 * unmappedInterests() so the table can be grown from real data.
 */
export function categoriesForInterest(label: string): Category[] {
  const mapped = NORMALIZED.get(normalizeLabel(label));
  if (mapped) return mapped;

  /*
   * An interest that IS a category means that category.
   *
   * The sign-up questionnaire stores category names directly — "Maison",
   * "Sport" — and none of them is a key of the table above, whose keys are
   * the fine-grained things people say. Without this they would map to
   * nothing, and content_facet would go quietly empty for everybody who
   * answered it: the exact silent failure the table was built to end,
   * reintroduced through the form that fills it.
   */
  const canonical = CATEGORY_BY_NORMALIZED.get(normalizeLabel(label));
  return canonical ? [canonical] : [];
}

/** The categories a whole set of interests maps to, de-duplicated. */
export function categoriesForInterests(labels: string[]): Category[] {
  const out = new Set<Category>();
  for (const label of labels) {
    for (const category of categoriesForInterest(label)) out.add(category);
  }
  return [...out];
}

/**
 * Which of these interests the table does not know.
 *
 * The measurement that keeps the table honest: a mapping nobody maintains
 * degrades into the strict-equality failure it replaced, silently.
 */
export function unmappedInterests(labels: string[]): string[] {
  return [...new Set(labels.filter((l) => categoriesForInterest(l).length === 0))];
}

/** Whether a string is one of the canonical categories. */
export function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
  );
}
