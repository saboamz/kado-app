import {
  averagePrecisionAt,
  categoryPopularityStrategy,
  coverage,
  judge,
  ndcgAt,
  novelty,
  popularityStrategy,
  randomStrategy,
  recallAt,
  runEvaluation,
  scoreStrategy,
  temporalSplit,
  type Interaction,
  type Scores,
} from './evaluate';

/**
 * The evaluation harness.
 *
 * THE FIXTURE TRAP, stated up front because it invalidates everything else:
 * with a catalogue smaller than k, EVERY strategy returns the whole catalogue
 * and scores a perfect recall — including random, which then "beats"
 * popularity. That is not a broken metric, it is a fixture incapable of
 * distinguishing anything. So: 60 products, asserted below.
 */

const CATALOGUE_SIZE = 60;
const catalogue = Array.from({ length: CATALOGUE_SIZE }, (_, i) => `p${i}`);

const day = (n: number) => new Date(2026, 0, 1 + n);

/**
 * A world where taste is real AND the past informs the future.
 *
 * The second half is a fixture property that is easy to lose: the first
 * version keyed productId off the time index, so every product in the test
 * window was one the train window had never seen. Popularity then scored a
 * flat 0 and lost to random — not because the metric was wrong, but because
 * no past-based strategy could possibly have predicted that future.
 *
 * Here each user draws from a fixed favourite pool, skewed toward the front,
 * across the whole time range. Popular items therefore recur on both sides of
 * the cut, which is what makes popularity a meaningful baseline at all.
 */
function buildInteractions(): Interaction[] {
  const out: Interaction[] = [];
  const categories = ['cuisine', 'audio', 'jardin'];

  for (let u = 0; u < 30; u++) {
    const group = u % 3;
    const category = categories[group]!;
    for (let n = 0; n < 8; n++) {
      // Skewed draw inside the user's category block: index 0 is drawn most
      // often, so a popularity gradient exists and persists over time.
      const skewed = Math.floor((n * n) / 8) % 6;
      const index = group * 20 + skewed;
      out.push({
        actorId: `u${u}`,
        productId: `p${index}`,
        categoryId: category,
        weight: 6,
        // Time is driven by the user, not by which product it is, so the
        // product distribution is the same before and after the cut.
        occurredAt: day(u * 2 + n),
      });
    }
  }
  return out;
}

describe('the fixture can distinguish strategies at all', () => {
  it('has a catalogue larger than k', () => {
    // With catalogue <= k every strategy returns everything and scores 1.0.
    // This assertion is what stops the rest of the file from being theatre.
    expect(catalogue.length).toBeGreaterThan(12);
    expect(catalogue.length).toBeGreaterThanOrEqual(60);
  });

  it('does not let random score a perfect recall', () => {
    const split = temporalSplit(buildInteractions());
    const scores = scoreStrategy(randomStrategy(catalogue), split, catalogue);
    // If this is 1.0 the fixture is too small and every comparison below is
    // meaningless, whatever the numbers say.
    expect(scores.recall).toBeLessThan(1);
  });
});

describe('the split is temporal, and a partition', () => {
  const interactions = buildInteractions();

  it('puts no event on both sides', () => {
    const { train, test } = temporalSplit(interactions);
    const key = (i: Interaction) => `${i.actorId}:${i.productId}:${i.occurredAt.getTime()}`;
    const trainKeys = new Set(train.map(key));
    const overlap = test.filter((i) => trainKeys.has(key(i)));

    // A partition: no event in both halves. Overlap would let the model be
    // scored on data it trained on.
    expect(overlap).toEqual([]);
    expect(train.length + test.length).toBe(interactions.length);
  });

  it('puts every test event strictly after every train event', () => {
    const { train, test } = temporalSplit(interactions);
    const latestTrain = Math.max(...train.map((i) => i.occurredAt.getTime()));
    const earliestTest = Math.min(...test.map((i) => i.occurredAt.getTime()));

    // The whole point. A random split scores the model on predicting the past
    // from the future, which inflates every metric — and inflates the WEAKEST
    // models most, exactly the wrong direction for deciding what to keep.
    expect(earliestTest).toBeGreaterThan(latestTrain);
  });

  it('leaves both sides non-empty', () => {
    const { train, test } = temporalSplit(interactions);
    expect(train.length).toBeGreaterThan(0);
    expect(test.length).toBeGreaterThan(0);
  });

  it('cuts at the requested fraction, not at an arbitrary point', () => {
    // Found by sabotage: replacing the chronological sort with a random one
    // left every assertion above green. The final filters are by date, so the
    // two halves stay time-ordered no matter how the array was sorted — only
    // the CUT MOVES, to wherever the shuffled element happened to sit. A 23/77
    // split still "passes" a test that only checks train < test.
    //
    // So the size is asserted too: that is the part a broken sort destroys.
    const { train, test } = temporalSplit(interactions, 0.2);
    const total = train.length + test.length;
    expect(test.length / total).toBeGreaterThan(0.1);
    expect(test.length / total).toBeLessThan(0.35);
    expect(train.length).toBeGreaterThan(test.length);
  });

  it('honours a different test fraction', () => {
    const { train, test } = temporalSplit(interactions, 0.5);
    const total = train.length + test.length;
    expect(test.length / total).toBeGreaterThan(0.35);
    expect(test.length / total).toBeLessThan(0.65);
  });

  it('survives an empty input without dividing by zero', () => {
    const split = temporalSplit([]);
    expect(split.train).toEqual([]);
    expect(split.test).toEqual([]);
  });
});

describe('metrics', () => {
  const relevant = new Set(['a', 'b', 'c']);

  it('recall counts the share of relevant items found', () => {
    expect(recallAt(['a', 'b', 'x'], relevant, 12)).toBeCloseTo(2 / 3, 6);
    expect(recallAt(['x', 'y'], relevant, 12)).toBe(0);
    expect(recallAt(['a', 'b', 'c'], relevant, 12)).toBe(1);
  });

  it('recall respects k', () => {
    expect(recallAt(['x', 'x', 'x', 'a'], relevant, 3)).toBe(0);
  });

  it('MAP rewards putting the hits early', () => {
    const early = averagePrecisionAt(['a', 'b', 'x', 'x'], relevant, 12);
    const late = averagePrecisionAt(['x', 'x', 'a', 'b'], relevant, 12);
    expect(early).toBeGreaterThan(late);
  });

  it('NDCG rewards ranking, and is 1 for a perfect list', () => {
    expect(ndcgAt(['a', 'b', 'c'], relevant, 12)).toBeCloseTo(1, 6);
    expect(ndcgAt(['a', 'b', 'c'], relevant, 12)).toBeGreaterThan(
      ndcgAt(['x', 'a', 'b'], relevant, 12),
    );
  });

  it('every metric is zero when nothing is relevant', () => {
    const empty = new Set<string>();
    expect(recallAt(['a'], empty, 12)).toBe(0);
    expect(averagePrecisionAt(['a'], empty, 12)).toBe(0);
    expect(ndcgAt(['a'], empty, 12)).toBe(0);
  });

  it('coverage catches a recommender that is boring but accurate', () => {
    // The reason coverage is in the report. A system showing the same twenty
    // products forever can score well on recall, and recall will never say so.
    const narrow = Array.from({ length: 30 }, () => ['p1', 'p2']);
    const broad = Array.from({ length: 30 }, (_, i) => [`p${i}`, `p${i + 30}`]);

    expect(coverage(narrow, CATALOGUE_SIZE)).toBeLessThan(0.1);
    expect(coverage(broad, CATALOGUE_SIZE)).toBeGreaterThan(0.5);
  });

  it('novelty rewards showing the long tail', () => {
    const counts = new Map([
      ['head', 1000],
      ['tail', 1],
    ]);
    expect(novelty([['tail']], counts, 1001)).toBeGreaterThan(
      novelty([['head']], counts, 1001),
    );
  });
});

describe('the baselines rank the way they should', () => {
  const split = temporalSplit(buildInteractions());

  const score = (s: Scores) => s.ndcg;

  it('popularity beats random', () => {
    const random = scoreStrategy(randomStrategy(catalogue), split, catalogue);
    const popular = scoreStrategy(popularityStrategy(split.train), split, catalogue);
    // If this ever inverts, either the fixture is too small or the metric is
    // wrong — random beating popularity is the classic symptom.
    expect(score(popular)).toBeGreaterThan(score(random));
  });

  it('category popularity is the real bar, above plain popularity', () => {
    const popular = scoreStrategy(popularityStrategy(split.train), split, catalogue);
    const byCategory = scoreStrategy(
      categoryPopularityStrategy(split.train),
      split,
      catalogue,
    );
    expect(score(byCategory)).toBeGreaterThanOrEqual(score(popular));
  });

  it('is reproducible: random is seeded', () => {
    // An unseeded shuffle makes the whole report irreproducible, and a number
    // you cannot reproduce cannot settle an argument about shipping a tier.
    const a = scoreStrategy(randomStrategy(catalogue, 42), split, catalogue);
    const b = scoreStrategy(randomStrategy(catalogue, 42), split, catalogue);
    expect(a).toEqual(b);
  });

  it('reports how many users it actually scored', () => {
    // A verdict computed over three users is noise wearing a decimal point.
    // The count travels with the scores so a reader can see the n rather than
    // having to trust the mean.
    const scores = scoreStrategy(popularityStrategy(split.train), split, catalogue);
    expect(scores.users).toBeGreaterThan(0);
    expect(scores.users).toBe(new Set(split.test.map((i) => i.actorId)).size);
  });

  it('shows the trade-off coverage exists to expose', () => {
    // Random has the best coverage and the worst ranking. If a report ever
    // shows a tier winning on NDCG *and* on coverage against these baselines,
    // that is a result worth double-checking rather than celebrating.
    const random = scoreStrategy(randomStrategy(catalogue), split, catalogue);
    const popular = scoreStrategy(popularityStrategy(split.train), split, catalogue);
    expect(random.coverage).toBeGreaterThan(popular.coverage);
    expect(random.ndcg).toBeLessThan(popular.ndcg);
  });

  it('scores all three baselines on every run', () => {
    const { baselines } = runEvaluation(split, catalogue);
    // Reporting a tier's number without the bar it had to clear is how a tier
    // survives that should not.
    expect(Object.keys(baselines).sort()).toEqual([
      'category_popularity',
      'popularity',
      'random',
    ]);
  });
});

describe('the verdict', () => {
  const good: Scores = { recall: 0.5, map: 0.4, ndcg: 0.5, coverage: 0.3, novelty: 5, users: 30 };
  const bar: Scores = { recall: 0.4, map: 0.3, ndcg: 0.4, coverage: 0.2, novelty: 4, users: 30 };

  it('returns the comparison, not a boolean', () => {
    const verdict = judge('cf_item', good, 'category_popularity', bar);
    // "By how much" is what decides whether the extra machinery is worth
    // maintaining, so the lift is part of the answer.
    expect(verdict.lift).toBeCloseTo(0.25, 6);
    expect(verdict.candidateScores).toBe(good);
    expect(verdict.barScores).toBe(bar);
  });

  it('says plainly when a tier should not ship', () => {
    const verdict = judge('cf_item', bar, 'category_popularity', good);
    expect(verdict.beatsBar).toBe(false);
    // The wording matters: it names the honest action rather than inviting
    // another round of tuning until the numbers agree.
    expect(verdict.summary).toContain('does NOT beat the bar');
    expect(verdict.summary).toContain('ship the measurement, not the tier');
  });

  it('does not call a tie a win', () => {
    const verdict = judge('cf_item', bar, 'category_popularity', { ...bar });
    expect(verdict.beatsBar).toBe(false);
  });

  it('judges against category popularity, never against random', () => {
    const split = temporalSplit(buildInteractions());
    const { verdict } = runEvaluation(split, catalogue, {
      name: 'cf_item',
      strategy: randomStrategy(catalogue),
    });
    // Beating random or global popularity proves almost nothing; the bar is
    // the one the CF probably will not clear at launch.
    expect(verdict!.bar).toBe('category_popularity');
  });

  it('reports a candidate that loses to the bar as losing', () => {
    const split = temporalSplit(buildInteractions());
    const { verdict } = runEvaluation(split, catalogue, {
      name: 'random_pretending_to_be_cf',
      strategy: randomStrategy(catalogue),
    });
    // A random candidate must lose. If this ever passes, the harness is
    // incapable of failing a tier and every verdict it issues is worthless.
    expect(verdict!.beatsBar).toBe(false);
    expect(verdict!.summary).toContain('does NOT beat the bar');
  });
});

describe('the harness can actually fail a tier', () => {
  /**
   * Guards the guard. A harness that always says "ship it" is worse than no
   * harness: it launders a bad tier through a process that looks rigorous.
   */
  it('passes a genuinely better candidate', () => {
    const split = temporalSplit(buildInteractions());
    // An oracle that returns exactly what the user will interact with.
    const relevantByUser = new Map<string, string[]>();
    for (const i of split.test) {
      relevantByUser.set(i.actorId, [...(relevantByUser.get(i.actorId) ?? []), i.productId]);
    }
    const oracle = (userId: string, k: number) =>
      (relevantByUser.get(userId) ?? []).slice(0, k);

    const { verdict } = runEvaluation(split, catalogue, { name: 'oracle', strategy: oracle });
    // The other half of the pair: the harness says yes to something that
    // genuinely is better, so its "no" above means refused, not broken.
    expect(verdict!.beatsBar).toBe(true);
    expect(verdict!.summary).toContain('worth keeping');
  });
});
