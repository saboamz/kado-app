import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { translator } from './i18n/t';
import {
  daysUntilDate,
  distinctOccasion,
  formatDateCountdown,
  formatMoney,
  initials,
  parseMoney,
  priorityLabel,
} from './format';

/* One translator per language, shared by every case below. */
const inFrench = translator('fr', fr);
const inEnglish = translator('en', en);

describe('formatMoney', () => {
  it('drops the decimals on a round amount', () => {
    expect(formatMoney(27900).replace(/ | /g, ' ')).toBe('279 €');
  });

  it('keeps them when they matter', () => {
    expect(formatMoney(1250).replace(/ | /g, ' ')).toBe('12,50 €');
  });

  it('renders a dash for an unpriced idea', () => {
    expect(formatMoney(null)).toBe('—');
  });
});

describe('parseMoney', () => {
  it.each([
    ['1599', 159900],
    ['1599.90', 159990],
    ['1599,90', 159990],
    ['1 599,90', 159990],
    ['12,5', 1250],
    ['0', 0],
  ])('parses %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it('rounds to whole cents rather than storing a float', () => {
    expect(parseMoney('0.005')).toBe(1);
  });

  it.each([['', ''], ['abc', 'letters'], ['-5', 'negative']])(
    'rejects %s',
    (input) => {
      expect(parseMoney(input)).toBeNull();
    },
  );
});

describe('daysUntilDate', () => {
  const from = new Date(2026, 2, 1); // 1 March 2026

  it('counts forward within the same year', () => {
    expect(daysUntilDate(14, 3, from)).toBe(13);
  });

  it('returns zero on the day itself', () => {
    expect(daysUntilDate(1, 3, from)).toBe(0);
  });

  it('rolls over to next year for a date already past', () => {
    // 1 February is behind us, so the next one is eleven months away.
    expect(daysUntilDate(1, 2, from)).toBe(337);
  });

  it('carries 29 February to the next leap year', () => {
    // The event has no year to be a leap of, so the next real 29 February is
    // what it means: 2028 from here.
    expect(daysUntilDate(29, 2, from)).toBe(730);
  });
});

describe('formatDateCountdown', () => {
  it.each([
    [0, 'c’est aujourd’hui'],
    [1, 'demain'],
    [12, 'dans 12 jours'],
    [30, 'dans 30 jours'],
    [60, 'dans 2 mois'],
  ])('renders %i days as %s', (days, expected) => {
    expect(formatDateCountdown(days, inFrench)).toBe(expected);
  });

  it.each([
    [0, 'it’s today'],
    [1, 'tomorrow'],
    [12, 'in 12 days'],
    [60, 'in 2 months'],
  ])('renders %i days as %s in English', (days, expected) => {
    expect(formatDateCountdown(days, inEnglish)).toBe(expected);
  });
});

describe('initials', () => {
  it.each([
    ['Sophie Marchand', 'SM'],
    ['Sophie', 'S'],
    ['  jean-luc  picard ', 'JP'],
    ['', '?'],
  ])('turns %s into %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('priorityLabel', () => {

  it('names each level', () => {
    // Wording comes from the design system: written from the wisher's side
    // rather than as a rank.
    expect(priorityLabel(3, inFrench)).toBe('Ça me ferait très plaisir');
    expect(priorityLabel(1, inFrench)).toBe('Une idée, sans plus');
  });

  it('names each level in English too', () => {
    // The labels used to live in a module-level array, which is evaluated
    // once at import — so it could only ever hold one language, whichever
    // loaded first.
    expect(priorityLabel(3, inEnglish)).toBe('I’d love it');
    expect(priorityLabel(1, inEnglish)).toBe('A passing idea');
  });

  it('stays empty for an unknown level', () => {
    expect(priorityLabel(9, inFrench)).toBe('');
  });
});

describe('distinctOccasion', () => {
  it('drops the occasion when it just repeats the name', () => {
    // The duplication this exists to stop: "Anniversaire" printed twice, one
    // line under the other, on both the list index and the list detail.
    expect(distinctOccasion('Anniversaire', 'Anniversaire')).toBeNull();
    expect(distinctOccasion('Noël', 'noël')).toBeNull();
    expect(distinctOccasion('Noël ', ' Noël')).toBeNull();
  });

  it('keeps an occasion that adds something', () => {
    expect(distinctOccasion('Mes envies', 'Noël')).toBe('Noël');
    expect(distinctOccasion('Nouvel appartement', 'Crémaillère')).toBe(
      'Crémaillère',
    );
  });

  it('treats a missing occasion as nothing to show', () => {
    expect(distinctOccasion('Mes envies', null)).toBeNull();
    expect(distinctOccasion('Mes envies', undefined)).toBeNull();
    expect(distinctOccasion('Mes envies', '')).toBeNull();
  });
});
