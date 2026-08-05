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

/** Canonical product categories. Kept small deliberately. */
export const CATEGORIES = [
  'Maison',
  'Sport',
  'Tech',
  'Voyage',
  'Culture',
  'Mode',
  'Gourmandise',
  'Bien-être',
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
  vin: ['Gourmandise'],
  céramique: ['Maison'],
  poterie: ['Maison'],
  design: ['Maison', 'Mode'],
  décoration: ['Maison'],
  jardinage: ['Maison'],
  plantes: ['Maison'],
  bricolage: ['Maison'],
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
  musique: ['Culture', 'Tech'],
  lecture: ['Culture'],
  livres: ['Culture'],
  cinéma: ['Culture'],
  photographie: ['Culture', 'Tech'],
  'jeux vidéo': ['Tech', 'Culture'],
  informatique: ['Tech'],
  voyage: ['Voyage'],
  camping: ['Voyage', 'Sport'],
  mode: ['Mode'],
  bijoux: ['Mode'],
  parfum: ['Bien-être', 'Mode'],
  'soins du visage': ['Bien-être'],
  méditation: ['Bien-être'],
};

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
  return NORMALIZED.get(normalizeLabel(label)) ?? [];
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
