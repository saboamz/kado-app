import type { Encoder } from './embed';
import { EMBEDDING_DIM, EMBEDDING_MODEL } from './embed';

/**
 * The real encoder, and the check that it is the multilingual one.
 *
 * Kept out of embed.ts so the test suite can exercise the pipeline with a fake
 * without pulling a 120 MB model into every run. Only the cron loads this.
 *
 * ── WHY THE ASSERTION BELOW EXISTS ──────────────────────────────────────
 *
 * Swapping in an English-only model is a one-word edit and produces no error:
 * the vectors still have 384 dimensions, the cosine queries still answer, the
 * page still renders. French text simply becomes noise, and the only symptom
 * is recommendations that feel subtly random months later.
 *
 * assertMultilingual() turns that silent failure into a loud one by measuring
 * the property directly — a French phrase and its English translation must be
 * close, while an unrelated French phrase must be far.
 */

/** Xenova's ONNX port of the model named in EMBEDDING_MODEL. */
const MODEL_ID = `Xenova/${EMBEDDING_MODEL}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
let pipelinePromise: Promise<any> | null = null;

/** Loads once per process: the model costs seconds to initialise, not ms. */
async function getPipeline(): Promise<any> {
  if (!pipelinePromise) {
    const { pipeline } = await import('@xenova/transformers');
    pipelinePromise = pipeline('feature-extraction', MODEL_ID);
  }
  return pipelinePromise;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The production encoder.
 *
 * Mean pooling and L2 normalisation, so cosine distance is a dot product and
 * pgvector's `<=>` means what the tier assumes it means.
 */
export const realEncoder: Encoder = async (texts) => {
  if (texts.length === 0) return [];

  const pipe = await getPipeline();
  const output = await pipe(texts, { pooling: 'mean', normalize: true });

  const flat = Array.from(output.data as Float32Array);
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(flat.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM));
  }
  return vectors;
};

const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

export type MultilingualCheck = {
  ok: boolean;
  crossLingual: number;
  unrelated: number;
  detail: string;
};

/**
 * Measures whether the loaded model actually handles French.
 *
 * A French phrase and its English translation must sit closer together than
 * that same French phrase and an unrelated French one. An English-only encoder
 * fails this: it maps most French input to a similar patch of space, so the
 * cross-lingual pair is no closer than the unrelated pair.
 *
 * Thresholds are deliberately loose — this is a smoke test for "is the model
 * broken", not a benchmark. The real multilingual model scores ~0.75 against
 * ~0.08 here, so the gap it is checking for is enormous.
 */
export async function assertMultilingual(
  encoder: Encoder = realEncoder,
): Promise<MultilingualCheck> {
  const [french, english, unrelatedFrench] = await encoder([
    'Théière en fonte émaillée pour le thé',
    'Cast iron teapot for tea',
    'Vélo de route en carbone',
  ]);

  const crossLingual = dot(french!, english!);
  const unrelated = dot(french!, unrelatedFrench!);

  const ok = crossLingual > 0.4 && crossLingual > unrelated + 0.2;

  return {
    ok,
    crossLingual,
    unrelated,
    detail: ok
      ? `multilingual: fr~en ${crossLingual.toFixed(3)} vs fr~unrelated ${unrelated.toFixed(3)}`
      : `NOT MULTILINGUAL — fr~en ${crossLingual.toFixed(3)} is not clear of fr~unrelated ${unrelated.toFixed(3)}. ` +
        `French text is being embedded as noise, and nothing else will report it.`,
  };
}
