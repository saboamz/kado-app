import {
  daysUntilBirthday,
  formatBirthdayCountdown,
  formatMoney,
  initials,
  parseMoney,
  priorityLabel,
} from './format';

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

describe('daysUntilBirthday', () => {
  const from = new Date(2026, 2, 1); // 1 March 2026

  it('counts forward within the same year', () => {
    expect(daysUntilBirthday(new Date(1990, 2, 14), from)).toBe(13);
  });

  it('returns zero on the day itself', () => {
    expect(daysUntilBirthday(new Date(1990, 2, 1), from)).toBe(0);
  });

  it('rolls over to next year for a date already past', () => {
    // 1 February is behind us, so the next one is eleven months away.
    expect(daysUntilBirthday(new Date(1990, 1, 1), from)).toBe(337);
  });
});

describe('formatBirthdayCountdown', () => {
  it.each([
    [0, "c'est aujourd'hui"],
    [1, 'demain'],
    [12, 'dans 12 jours'],
    [30, 'dans 30 jours'],
    [60, 'dans 2 mois'],
  ])('renders %i days as %s', (days, expected) => {
    expect(formatBirthdayCountdown(days)).toBe(expected);
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
    expect(priorityLabel(3)).toBe('Coup de cœur');
    expect(priorityLabel(1)).toBe('Ce serait sympa');
  });

  it('stays empty for an unknown level', () => {
    expect(priorityLabel(9)).toBe('');
  });
});
