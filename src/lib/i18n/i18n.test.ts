import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from './en';
import { fr } from './fr';
import { DEFAULT_LOCALE, isLocale, localeFromHeader, LOCALES } from './locales';
import { translateError, translator, type Plural } from './t';

/**
 * What holds the two languages together.
 *
 * The type system already refuses a missing key — en.ts is typed as the shape
 * of fr.ts, so `tsc` fails on drift. These are the things a type cannot see:
 * a phrase whose placeholders differ between languages, a plural form left
 * identical to the singular, and French text still sitting in a component.
 */
describe('the two dictionaries', () => {
  it('define exactly the same keys', () => {
    // Belt and braces: the compiler enforces this, but a cast anywhere in
    // en.ts would silence it, and a blank label is invisible in review.
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('use the same placeholders in both languages', () => {
    // A phrase that says {count} in French and {number} in English renders
    // the literal word "{number}" to an English reader — filled placeholders
    // are left as-is on purpose, so this never throws, it just looks broken.
    const holders = (value: string | Plural): string =>
      [...(typeof value === 'string' ? value : value.one + value.other)
        .matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .sort()
        .join(',');

    const mismatched = Object.keys(fr).filter(
      (key) =>
        holders(fr[key as keyof typeof fr]) !== holders(en[key as keyof typeof en]),
    );

    expect(mismatched).toEqual([]);
  });

  it('leave no phrase untranslated', () => {
    // A key copied from French into en.ts and never translated. Proper nouns
    // and codes are legitimately identical, so only multi-word phrases count.
    const suspicious = Object.keys(fr).filter((key) => {
      const a = fr[key as keyof typeof fr];
      const b = en[key as keyof typeof en];
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      return a === b && a.trim().includes(' ');
    });

    expect(suspicious).toEqual([]);
  });
});

describe('plural forms', () => {
  it('choose the right form for each language at zero', () => {
    // The reason plurals are not a `> 1 ? 's' : ''` in a component: French
    // and English disagree here, and no single expression is right for both.
    const inFrench = translator('fr', fr);
    const inEnglish = translator('en', en);

    expect(inFrench('common.wishes', { count: 0 })).toBe('0 envie');
    expect(inEnglish('common.wishes', { count: 0 })).toBe('0 wishes');
  });

  it('agree at one and disagree at many', () => {
    const inEnglish = translator('en', en);
    expect(inEnglish('common.wishes', { count: 1 })).toBe('1 wish');
    expect(inEnglish('common.wishes', { count: 4 })).toBe('4 wishes');
  });
});

describe('filling in the blanks', () => {
  const t = translator('fr', fr);

  it('substitutes a value', () => {
    expect(t('home.greeting', { name: 'Sabri' })).toBe('Bonjour Sabri');
  });

  it('leaves an unfilled placeholder visible', () => {
    // Rendering the word "undefined" to somebody would be worse: this way the
    // gap says which value was not passed.
    expect(t('home.greeting')).toBe('Bonjour {name}');
  });
});

describe('errors coming back from a server action', () => {
  const t = translator('en', en);

  it('turn a key into a sentence', () => {
    expect(translateError(t, en, 'error.giftNotFound')).toBe('Gift not found');
  });

  it('pass through anything that is not a key', () => {
    // Some errors carry text from elsewhere; showing it beats showing nothing.
    expect(translateError(t, en, 'Boom')).toBe('Boom');
    expect(translateError(t, en, undefined)).toBeUndefined();
  });
});

describe('choosing a language for a visitor', () => {
  it('honours quality values rather than position', () => {
    // `en;q=0.4, fr;q=0.9` asks for French, despite English coming first.
    expect(localeFromHeader('en;q=0.4, fr;q=0.9')).toBe('fr');
    expect(localeFromHeader('fr;q=0.2, en;q=0.8')).toBe('en');
  });

  it('treats a regional tag as its base language', () => {
    expect(localeFromHeader('en-GB,en;q=0.9')).toBe('en');
    expect(localeFromHeader('fr-CA')).toBe('fr');
  });

  it('falls back when nothing matches', () => {
    expect(localeFromHeader('de,it;q=0.8')).toBe(DEFAULT_LOCALE);
    expect(localeFromHeader(null)).toBe(DEFAULT_LOCALE);
    expect(localeFromHeader('')).toBe(DEFAULT_LOCALE);
  });

  it('ignores a language explicitly refused', () => {
    // q=0 means "not this one", so it must not win by being the only match.
    expect(localeFromHeader('en;q=0')).toBe(DEFAULT_LOCALE);
  });

  it('recognises only the languages we actually speak', () => {
    expect(LOCALES.every(isLocale)).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

/** Every .tsx under a directory, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('the components themselves', () => {
  it('have no French left hard-coded in them', () => {
    /*
     * The check that stops this work from rotting.
     *
     * Adding a page with `title="Mes listes"` typechecks perfectly and looks
     * fine to a French reviewer — it simply never translates. Nothing but a
     * sweep like this notices.
     */
    /*
     * Two files are exempt, and it is worth saying why.
     *
     * layout.tsx's OpenGraph description and opengraph-image.tsx are what a
     * pasted link looks like in a group chat. They are rendered for a
     * SCRAPER, before anyone has opened anything — there is no reader, no
     * session and no Accept-Language to read. Whoever eventually sees the
     * card gets the app in their own language the moment they click.
     *
     * Serving them per-language would mean a URL that carries the language,
     * which is the /fr /en split this design deliberately did not take.
     */
    const EXEMPT = ['src/app/layout.tsx', 'src/app/opengraph-image.tsx'];

    const files = ['src/app', 'src/components']
      .flatMap(walk)
      .filter((file) => !EXEMPT.includes(file));
    expect(files.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        // Comments explain decisions in prose and are not rendered.
        const code = line.trim();
        if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) {
          continue;
        }
        const props =
          /\b(title|body|subtitle|label|placeholder|hint|cta|submitLabel|pendingLabel)="[^"]*[a-z][^"]*"/;
        /*
         * Anywhere, not just after `>` or a quote.
         *
         * "Masquer" survived the first version of this sweep by sitting
         * inside a ternary — {dismissing ? '…' : 'Masquer'} — and shipped
         * untranslated onto the English home page. A word is a word wherever
         * it appears.
         */
        const frenchWords =
          /\b(?:Ajouter|Modifier|Supprimer|Enregistrer|Annuler|Masquer|Créer|Chercher|Envoyer|Réserver|Participer|Vos|Votre|Mes|Cette|Aucun|Aucune|Votre)\b/;
        if (props.test(line) || frenchWords.test(line)) {
          offenders.push(`${file}:${index + 1} ${code.slice(0, 80)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
