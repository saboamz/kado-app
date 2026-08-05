/**
 * Nightly embedding job.
 *
 * Run with: npm run embed
 *
 * Embeds in batches until nothing is pending. Refuses to write ANY vector
 * until the loaded model has been shown to handle French — an English-only
 * encoder produces correctly-shaped vectors and working queries, so without
 * this check a model swap would silently fill the catalogue with noise and the
 * only symptom would appear months later as vaguely random recommendations.
 */

import { db } from '../src/lib/db';
import { BATCH_SIZE, embedBatch, embeddingCoverage } from '../src/lib/embed';
import { assertMultilingual, realEncoder } from '../src/lib/encoder';

async function main() {
  console.log('Vérification du modèle…');
  const check = await assertMultilingual();
  console.log(`  ${check.detail}`);

  if (!check.ok) {
    // Exit before writing anything. A partially-embedded catalogue mixing a
    // good model with a broken one is worse than an unembedded one, because
    // the queries keep working and nobody notices.
    console.error('\nAucun vecteur écrit : le modèle chargé ne gère pas le français.');
    process.exit(1);
  }

  const before = await embeddingCoverage();
  console.log(`\nCatalogue : ${before.embedded}/${before.total} encodés`);
  if (before.models.length > 1) {
    console.warn(`  ATTENTION — plusieurs modèles présents : ${before.models.join(', ')}`);
    console.warn('  Les comparaisons entre modèles n\'ont aucun sens. Purgez avant de continuer.');
  }

  let total = 0;
  for (;;) {
    const written = await embedBatch(realEncoder, BATCH_SIZE);
    if (written === 0) break;
    total += written;
    console.log(`  ${total} produits encodés…`);
  }

  const after = await embeddingCoverage();
  console.log(`\nTerminé : ${total} encodés, couverture ${after.embedded}/${after.total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
