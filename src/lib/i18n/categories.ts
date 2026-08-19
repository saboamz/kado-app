import type { Category } from '../taxonomy';
import type { Locale } from './locales';

/**
 * What each product category is CALLED, per language.
 *
 * ── Why the stored value stays French ──────────────────────────────────────
 *
 * Product.categoryId and Gift.category hold these exact French strings, and
 * the recommender's content_facet tier matches interests against them with
 * strict equality. Translating at the source would mean the same category
 * filed under two spellings — the precise failure the closed list in
 * taxonomy.ts was introduced to end.
 *
 * So the stored value is an identifier that happens to be a French word, and
 * this table is the display layer over it. Nothing here reaches the database.
 */
const NAMES: Record<Locale, Record<Category, string>> = {
  fr: {
    Maison: 'Maison',
    Jardin: 'Jardin',
    Bricolage: 'Bricolage',
    Tech: 'Tech',
    Jeux: 'Jeux',
    Sport: 'Sport',
    'Bien-être': 'Bien-être',
    Beauté: 'Beauté',
    Mode: 'Mode',
    Bijoux: 'Bijoux',
    Culture: 'Culture',
    Papeterie: 'Papeterie',
    Gourmandise: 'Gourmandise',
    Voyage: 'Voyage',
    Enfants: 'Enfants',
    Animaux: 'Animaux',
    Autre: 'Autre',
  },
  en: {
    Maison: 'Home',
    Jardin: 'Garden',
    Bricolage: 'DIY',
    Tech: 'Tech',
    Jeux: 'Games',
    Sport: 'Sport',
    'Bien-être': 'Wellbeing',
    Beauté: 'Beauty',
    Mode: 'Fashion',
    Bijoux: 'Jewellery',
    Culture: 'Culture',
    Papeterie: 'Stationery',
    Gourmandise: 'Food & drink',
    Voyage: 'Travel',
    Enfants: 'Children',
    Animaux: 'Pets',
    Autre: 'Other',
  },
};

/**
 * The name to show for a stored category.
 *
 * Unknown values pass through unchanged: a row written before the closed list
 * existed still has to render as something.
 */
export function categoryName(value: string, locale: Locale): string {
  const table = NAMES[locale];
  return value in table ? table[value as Category] : value;
}
