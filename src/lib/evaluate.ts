/**
 * The evaluation harness.
 *
 * Its purpose is to make it possible to DELETE a tier. Every recommender
 * arrives with an argument for existing; what is rare is the measurement that
 * would show it should not. So this returns a comparison against the bar it
 * had to clear, never a bare number and never a boolean.
 */

export type Interaction = {
  actorId: string;
  productId: string;
  categoryId: string | null;
  weight: number;
  occurredAt: Date;
};

export type Split = {
  train: Interaction[];
  test: Interaction[];
  /** The instant the split was cut, for reporting. */
  cutoff: Date;
};

/**
 * Splits TEMPORALLY, never at random.
 *
 * A random split puts a user's later gifts in train and their earlier ones in
 * test, so the model is scored on predicting the past from the future. That
 * inflates every metric, and inflates the WEAKEST models most — precisely the
 * wrong direction for deciding what to keep.
 *
 * The cutoff is a quantile of time, so both sides are non-empty whatever the
 * shape of the data.
 */
export function temporalSplit(
  interactions: Interaction[],
  testFraction = 0.2,
): Split {
  if (interactions.length === 0) {
    return { train: [], test: [], cutoff: new Date(0) };
  }

  const sorted = [...interactions].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const cutIndex = Math.max(1, Math.floor(sorted.length * (1 - testFraction)));
  const cutoff = sorted[cutIndex]?.occurredAt ?? sorted[sorted.length - 1]!.occurredAt;

  // Strictly before / on-or-after, so no event can land on both sides. The
  // partition assertion in the tests depends on this being exclusive.
  return {
    train: sorted.filter((i) => i.occurredAt < cutoff),
    test: sorted.filter((i) => i.occurredAt >= cutoff),
    cutoff,
  };
}

/* ── Metrics ─────────────────────────────────────────────────────────────── */

/** Share of the relevant items that appear in the top k. */
export function recallAt(recommended: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0;
  const hits = recommended.slice(0, k).filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

/** Mean average precision: rewards putting the hits early. */
export function averagePrecisionAt(
  recommended: string[],
  relevant: Set<string>,
  k: number,
): number {
  if (relevant.size === 0) return 0;
  let hits = 0;
  let sum = 0;
  recommended.slice(0, k).forEach((id, i) => {
    if (relevant.has(id)) {
      hits += 1;
      sum += hits / (i + 1);
    }
  });
  return sum / Math.min(relevant.size, k);
}

export function ndcgAt(recommended: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0;
  const dcg = recommended
    .slice(0, k)
    .reduce((acc, id, i) => acc + (relevant.has(id) ? 1 / Math.log2(i + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(relevant.size, k) }).reduce<number>(
    (acc, _, i) => acc + 1 / Math.log2(i + 2),
    0,
  );
  return ideal === 0 ? 0 : dcg / ideal;
}

/**
 * Share of the catalogue the recommender ever shows.
 *
 * This is the metric that catches a recommender scoring well by being boring:
 * a purely popular system gets decent recall while showing the same twenty
 * products forever, and recall alone will never say so.
 */
export function coverage(allRecommended: string[][], catalogueSize: number): number {
  if (catalogueSize === 0) return 0;
  return new Set(allRecommended.flat()).size / catalogueSize;
}

/**
 * Novelty: mean negative log popularity of what was shown.
 *
 * Higher means the recommender is surfacing the long tail rather than the same
 * head every time.
 */
export function novelty(
  allRecommended: string[][],
  popularityById: Map<string, number>,
  totalInteractions: number,
): number {
  const shown = allRecommended.flat();
  if (shown.length === 0 || totalInteractions === 0) return 0;

  const scores = shown.map((id) => {
    const count = popularityById.get(id) ?? 0;
    // +1 so a product nobody has touched is maximally novel rather than
    // undefined, which would drop it from the mean and flatter the model.
    const p = (count + 1) / (totalInteractions + 1);
    return -Math.log2(p);
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/* ── Baselines, in order of what they know ───────────────────────────────── */

export type Strategy = (userId: string, k: number) => string[];

/** 1. Random — the floor. If something loses to this, it is broken. */
export function randomStrategy(catalogue: string[], seed = 1): Strategy {
  // Deterministic PRNG: an unseeded shuffle makes the whole report
  // irreproducible, and a metric you cannot reproduce cannot settle anything.
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return (_userId, k) => {
    const pool = [...catalogue];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, k);
  };
}

/** 2. Popularity — the same list for everybody. */
export function popularityStrategy(train: Interaction[]): Strategy {
  const counts = new Map<string, number>();
  for (const i of train) {
    counts.set(i.productId, (counts.get(i.productId) ?? 0) + i.weight);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
  return (_userId, k) => ranked.slice(0, k);
}

/**
 * 3. Popularity within the user's categories — THE REAL BAR.
 *
 * The CF probably does not beat this at launch, and pretending otherwise costs
 * months. Reporting a tier's number without the bar it had to clear is how a
 * tier survives that should not.
 */
export function categoryPopularityStrategy(train: Interaction[]): Strategy {
  const byCategory = new Map<string, Map<string, number>>();
  const userCategories = new Map<string, Map<string, number>>();

  for (const i of train) {
    const category = i.categoryId ?? '__none';
    const products = byCategory.get(category) ?? new Map<string, number>();
    products.set(i.productId, (products.get(i.productId) ?? 0) + i.weight);
    byCategory.set(category, products);

    const seen = userCategories.get(i.actorId) ?? new Map<string, number>();
    seen.set(category, (seen.get(category) ?? 0) + i.weight);
    userCategories.set(i.actorId, seen);
  }

  const globalRanked = popularityStrategy(train);

  return (userId, k) => {
    const categories = [...(userCategories.get(userId)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);

    const out: string[] = [];
    for (const category of categories) {
      const ranked = [...(byCategory.get(category)?.entries() ?? [])]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([id]) => id);
      for (const id of ranked) {
        if (out.length >= k) break;
        if (!out.includes(id)) out.push(id);
      }
    }
    // A user with no history in train falls back to global popularity rather
    // than to an empty list, which would score 0 and flatter every rival.
    if (out.length < k) {
      for (const id of globalRanked(userId, k * 3)) {
        if (out.length >= k) break;
        if (!out.includes(id)) out.push(id);
      }
    }
    return out.slice(0, k);
  };
}

/* ── Scoring ─────────────────────────────────────────────────────────────── */

export type Scores = {
  recall: number;
  map: number;
  ndcg: number;
  coverage: number;
  novelty: number;
  /** How many users were actually scored. A tiny n makes the rest noise. */
  users: number;
};

export function scoreStrategy(
  strategy: Strategy,
  split: Split,
  catalogue: string[],
  k = 12,
): Scores {
  const relevantByUser = new Map<string, Set<string>>();
  for (const i of split.test) {
    const set = relevantByUser.get(i.actorId) ?? new Set<string>();
    set.add(i.productId);
    relevantByUser.set(i.actorId, set);
  }

  const trainCounts = new Map<string, number>();
  for (const i of split.train) {
    trainCounts.set(i.productId, (trainCounts.get(i.productId) ?? 0) + 1);
  }

  const all: string[][] = [];
  let recall = 0;
  let map = 0;
  let ndcg = 0;

  for (const [userId, relevant] of relevantByUser) {
    const recommended = strategy(userId, k);
    all.push(recommended);
    recall += recallAt(recommended, relevant, k);
    map += averagePrecisionAt(recommended, relevant, k);
    ndcg += ndcgAt(recommended, relevant, k);
  }

  const users = relevantByUser.size;
  if (users === 0) {
    return { recall: 0, map: 0, ndcg: 0, coverage: 0, novelty: 0, users: 0 };
  }

  return {
    recall: recall / users,
    map: map / users,
    ndcg: ndcg / users,
    coverage: coverage(all, catalogue.length),
    novelty: novelty(all, trainCounts, split.train.length),
    users,
  };
}

/* ── The verdict ─────────────────────────────────────────────────────────── */

export type Verdict = {
  candidate: string;
  bar: string;
  candidateScores: Scores;
  barScores: Scores;
  /** Relative lift on NDCG. Negative means it lost. */
  lift: number;
  beatsBar: boolean;
  /** The sentence a human reads. Deliberately blunt. */
  summary: string;
};

/**
 * Compares a candidate tier against the bar it had to clear.
 *
 * Returns the COMPARISON, not a boolean: "by how much" is what decides whether
 * the extra machinery is worth maintaining. If the candidate loses, the honest
 * answer is to take it out of the cascade — not to tune it until the numbers
 * agree.
 */
export function judge(
  candidateName: string,
  candidateScores: Scores,
  barName: string,
  barScores: Scores,
): Verdict {
  const lift =
    barScores.ndcg === 0
      ? candidateScores.ndcg > 0
        ? Infinity
        : 0
      : (candidateScores.ndcg - barScores.ndcg) / barScores.ndcg;

  const beatsBar = candidateScores.ndcg > barScores.ndcg;
  const pct = Number.isFinite(lift) ? `${(lift * 100).toFixed(1)}%` : 'n/a';

  const summary = beatsBar
    ? `${candidateName} beats ${barName} by ${pct} NDCG@12 — worth keeping`
    : `${candidateName} does NOT beat the bar (${barName}, ${pct} NDCG@12) — ship the measurement, not the tier`;

  return { candidate: candidateName, bar: barName, candidateScores, barScores, lift, beatsBar, summary };
}

/**
 * Runs every baseline plus the candidate, and judges against the real bar.
 *
 * All three baselines are scored on every run. Reporting a tier's number
 * without the bar is exactly how a tier survives that should not.
 */
export function runEvaluation(
  split: Split,
  catalogue: string[],
  candidate?: { name: string; strategy: Strategy },
  k = 12,
): { baselines: Record<string, Scores>; verdict: Verdict | null } {
  const baselines = {
    random: scoreStrategy(randomStrategy(catalogue), split, catalogue, k),
    popularity: scoreStrategy(popularityStrategy(split.train), split, catalogue, k),
    category_popularity: scoreStrategy(
      categoryPopularityStrategy(split.train),
      split,
      catalogue,
      k,
    ),
  };

  if (!candidate) return { baselines, verdict: null };

  const candidateScores = scoreStrategy(candidate.strategy, split, catalogue, k);
  return {
    baselines,
    // Judged against category popularity, never against random or global
    // popularity — beating those two proves almost nothing.
    verdict: judge(
      candidate.name,
      candidateScores,
      'category_popularity',
      baselines.category_popularity,
    ),
  };
}
