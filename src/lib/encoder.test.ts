import { assertMultilingual } from './encoder';
import { EMBEDDING_DIM, type Encoder } from './embed';

/**
 * The multilingual guard.
 *
 * This is the one property the fake encoder in embed.test.ts cannot check, and
 * the one the mission singles out: an English-only model produces
 * correctly-shaped vectors, answers cosine queries, and renders pages — it
 * just turns "Vase en grès émaillé" into noise, with no error anywhere.
 *
 * These tests run against SYNTHETIC encoders rather than the real model: a
 * 120 MB download does not belong in a unit suite. What they prove is that the
 * check itself discriminates — that it passes a multilingual encoder and fails
 * an English-only one. The real model is verified by `npm run embed`, which
 * refuses to write a single vector until this same function agrees.
 */

const unit = (seed: number[]): number[] => {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  seed.forEach((value, i) => {
    vector[i] = value;
  });
  const norm = Math.hypot(...vector) || 1;
  return vector.map((v) => v / norm);
};

/**
 * A multilingual encoder: the French phrase and its English translation land
 * near each other, the unrelated French phrase lands far away.
 */
const multilingualFake: Encoder = async (texts) =>
  texts.map((text) => {
    if (text.includes('Théière')) return unit([1, 0.1, 0]);
    if (text.includes('teapot')) return unit([0.95, 0.2, 0]);
    return unit([0, 0.1, 1]); // vélo
  });

/**
 * An English-only encoder: it cannot read French, so BOTH French phrases map
 * to a similar patch of space and the English one sits apart. Every vector is
 * still well-formed — which is exactly why this failure is silent.
 */
const englishOnlyFake: Encoder = async (texts) =>
  texts.map((text) => {
    if (text.includes('teapot')) return unit([1, 0, 0]);
    // French in, mush out — the two French phrases are barely distinguishable.
    if (text.includes('Théière')) return unit([0, 1, 0.05]);
    return unit([0, 1, 0]);
  });

describe('assertMultilingual', () => {
  it('passes an encoder that genuinely crosses languages', async () => {
    const check = await assertMultilingual(multilingualFake);
    expect(check.ok).toBe(true);
    expect(check.crossLingual).toBeGreaterThan(check.unrelated);
    expect(check.detail).toContain('multilingual');
  });

  it('FAILS an English-only encoder, which nothing else would catch', async () => {
    // The whole point. This encoder returns 384 well-formed unit vectors and
    // would embed the entire catalogue without a single error being raised.
    const check = await assertMultilingual(englishOnlyFake);
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('NOT MULTILINGUAL');
    // The message has to say what is actually wrong, because by the time
    // anyone reads it the symptom will be "the recommendations feel off".
    expect(check.detail).toContain('French text is being embedded as noise');
  });

  it('is not satisfied by an encoder that maps everything together', async () => {
    // A degenerate encoder returning one constant vector scores a perfect
    // cross-lingual similarity — and a check that only looked at that number
    // would wave it through. The gap against the unrelated pair is what makes
    // the assertion mean something.
    const constant: Encoder = async (texts) => texts.map(() => unit([1, 0, 0]));
    const check = await assertMultilingual(constant);
    expect(check.crossLingual).toBeCloseTo(1, 3);
    expect(check.ok).toBe(false);
  });

  it('is not satisfied by an encoder that maps everything apart', async () => {
    const orthogonal: Encoder = async (texts) =>
      texts.map((_, i) => unit(Array.from({ length: 3 }, (_, j) => (i === j ? 1 : 0))));
    const check = await assertMultilingual(orthogonal);
    expect(check.ok).toBe(false);
  });

  it('reports both numbers so a near-miss is diagnosable', async () => {
    // "It failed" is not actionable; "0.41 vs 0.38" says the model is weak
    // rather than wrong, which is a different fix.
    const check = await assertMultilingual(multilingualFake);
    expect(typeof check.crossLingual).toBe('number');
    expect(typeof check.unrelated).toBe('number');
    expect(check.detail).toMatch(/\d\.\d{3}/);
  });
});
