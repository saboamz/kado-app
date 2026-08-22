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
 * The interests offered at sign-up, as a grid to tick.
 *
 * A subset of the mapping table above, not the whole of it: forty-odd
 * checkboxes is a form nobody finishes, and several of the entries are
 * near-synonyms that exist so free text still matches ("course" and
 * "running", "livres" and "lecture"). One of each is enough here.
 *
 * Every value must be a key of INTEREST_TO_CATEGORIES, or it produces an
 * interest the recommender cannot map — the silent failure the mapping table
 * was built to end. A test holds them to that.
 */
export const SURVEY_INTERESTS = [
  'Café',
  'Cuisine',
  'Pâtisserie',
  'Céramique',
  'Design',
  'Décoration',
  'Jardinage',
  'Plantes',
  'Bricolage',
  'Randonnée',
  'Course',
  'Vélo',
  'Escalade',
  'Yoga',
  'Natation',
  'Ski',
  'Lecture',
  'Cinéma',
  'Photographie',
  'Jeux vidéo',
  'Jeux de société',
  'Informatique',
  'Voyage',
  'Camping',
  'Mode',
  'Bijoux',
  'Montres',
  'Parfum',
  'Maquillage',
  'Méditation',
  'Écriture',
  'Papeterie',
  'Dessin',
  'Chats',
  'Chiens',
  'Enfants',
] as const;

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

/** Whether a string is one of the canonical categories. */
export function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
  );
}
