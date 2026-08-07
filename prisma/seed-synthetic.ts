import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { normalizeUrl, priceBand, titleKey, urlHash } from '../src/lib/catalogue';
import { CF_READY_THRESHOLD } from '../src/lib/cf';
import { categoriesForInterest } from '../src/lib/taxonomy';
import { WEIGHTS } from '../src/lib/events';
import { loginSchema } from '../src/lib/validation';

/**
 * Synthetic demo data, deliberately kept BELOW the CF threshold.
 *
 * ── WHY IT STOPS SHORT ──────────────────────────────────────────────────
 *
 * Generating 5 000 gifting events would flip cfIsReady() to true and fire the
 * collaborative filter on correlations that were invented here. That is the
 * exact regime phase 5 exists to avoid: a CF running on too little real signal
 * produces confident nonsense, and confident nonsense is harder to notice than
 * an empty tier. Worse, anyone reading tierMix() six months from now would see
 * cf_item working and conclude the model had been validated.
 *
 * So this fills the catalogue, the wishes and the browsing history — enough
 * for content_facet and popularity to have something to rank, which is what
 * ships at launch — and asserts at the end that the gifting-event count is
 * still under the bar.
 *
 * Everything here is REPRODUCIBLE: a seeded PRNG, no Date.now() in the data
 * shape. Re-running produces the same catalogue.
 */

const db = new PrismaClient();

const DEMO_PASSWORD = 'kado1234';
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/** Tag on every row this script creates, so it can be removed cleanly. */
const TAG = 'synth';

/** Deterministic PRNG. An unseeded one makes the dataset unreproducible. */
let state = 20260805;
const rnd = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
/** Strips accents so the generated address passes the login validator. */
const slugifyName = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

/* ── Catalogue vocabulary ────────────────────────────────────────────────── */

const MERCHANTS = [
  { slug: 'nature-decouvertes', name: 'Nature & Découvertes', domains: ['natureetdecouvertes.fr'] },
  { slug: 'fnac', name: 'Fnac', domains: ['fnac.com'] },
  { slug: 'decathlon', name: 'Decathlon', domains: ['decathlon.fr'] },
  { slug: 'made-in-design', name: 'Made in Design', domains: ['madeindesign.com'] },
  { slug: 'cafes-richard', name: 'Cafés Richard', domains: ['cafesrichard.fr'] },
  { slug: 'la-redoute', name: 'La Redoute', domains: ['laredoute.fr'] },
];

/** Products per category, so an interest actually leads somewhere sensible. */
const PRODUCTS: Record<string, { title: string; brand: string; cents: number }[]> = {
  Maison: [
    { title: 'Théière en fonte émaillée 1,2 L', brand: 'Iwachu', cents: 8990 },
    { title: 'Service à thé en céramique japonaise', brand: 'Hasami', cents: 6500 },
    { title: 'Vase en grès émaillé fait main', brand: 'Atelier Cerámica', cents: 4500 },
    { title: 'Set de 4 bols en porcelaine', brand: 'Revol', cents: 3900 },
    { title: 'Lampe de bureau articulée laiton', brand: 'Anglepoise', cents: 21900 },
    { title: 'Plaid en laine mérinos', brand: 'Lestra', cents: 12900 },
    { title: 'Planche à découper en noyer', brand: 'Berard', cents: 5900 },
    { title: 'Sécateur de jardin forgé', brand: 'Felco', cents: 6900 },
    { title: 'Arrosoir en zinc 5 L', brand: 'Haws', cents: 4200 },
    { title: 'Cache-pot en terre cuite tourné', brand: 'Poterie du Marais', cents: 2800 },
  ],
  Gourmandise: [
    { title: 'Cafetière Chemex 6 tasses', brand: 'Chemex', cents: 4990 },
    { title: 'Moulin à café manuel en inox', brand: 'Comandante', cents: 24900 },
    { title: 'Coffret de thés grands crus', brand: 'Palais des Thés', cents: 4500 },
    { title: 'Balance de précision pour café', brand: 'Acaia', cents: 15900 },
    { title: 'Bouilloire col de cygne', brand: 'Hario', cents: 7900 },
    { title: 'Coffret chocolats grands crus', brand: 'Valrhona', cents: 3900 },
    { title: 'Huile d’olive AOP première pression', brand: 'Château Virant', cents: 2400 },
  ],
  Sport: [
    { title: 'Chaussures de randonnée cuir', brand: 'Meindl', cents: 18900 },
    { title: 'Sac à dos de randonnée 40 L', brand: 'Osprey', cents: 14900 },
    { title: 'Bâtons de marche télescopiques', brand: 'Black Diamond', cents: 8900 },
    { title: 'Casque de vélo route ventilé', brand: 'Giro', cents: 12900 },
    { title: 'Compteur GPS pour vélo', brand: 'Garmin', cents: 22900 },
    { title: 'Gourde isotherme 750 ml', brand: 'Klean Kanteen', cents: 3500 },
    { title: 'Tapis de yoga en liège', brand: 'Yogom', cents: 6900 },
    { title: 'Chaussons d’escalade', brand: 'La Sportiva', cents: 11900 },
  ],
  Culture: [
    { title: 'Enceinte bluetooth compacte', brand: 'Marshall', cents: 16900 },
    { title: 'Casque audio filaire studio', brand: 'Beyerdynamic', cents: 17900 },
    { title: 'Platine vinyle à entraînement direct', brand: 'Audio-Technica', cents: 29900 },
    { title: 'Coffret intégrale romans policiers', brand: 'Gallimard', cents: 5900 },
    { title: 'Liseuse à écran e-ink', brand: 'Kobo', cents: 13900 },
    { title: 'Appareil photo argentique 35 mm', brand: 'Pentax', cents: 34900 },
    { title: 'Carnet de notes reliure toilée A5', brand: 'Leuchtturm', cents: 2200 },
  ],
  Tech: [
    { title: 'Écouteurs sans fil à réduction de bruit', brand: 'Sony', cents: 27900 },
    { title: 'Clavier mécanique compact', brand: 'Keychron', cents: 10900 },
    { title: 'Batterie externe 20 000 mAh', brand: 'Anker', cents: 5900 },
    { title: 'Station d’accueil USB-C', brand: 'CalDigit', cents: 19900 },
  ],
  Voyage: [
    { title: 'Valise cabine rigide 55 cm', brand: 'Samsonite', cents: 15900 },
    { title: 'Trousse de toilette suspendue', brand: 'Aevor', cents: 4500 },
    { title: 'Adaptateur de voyage universel', brand: 'Skross', cents: 3200 },
    { title: 'Guide de voyage Islande', brand: 'Lonely Planet', cents: 2400 },
  ],
  Mode: [
    { title: 'Écharpe en cachemire', brand: 'Éric Bompard', cents: 12900 },
    { title: 'Ceinture en cuir pleine fleur', brand: 'Jean Rousseau', cents: 8900 },
    { title: 'Bracelet en argent massif', brand: 'Agatha', cents: 6900 },
  ],
  'Bien-être': [
    { title: 'Coffret d’huiles essentielles bio', brand: 'Puressentiel', cents: 4900 },
    { title: 'Diffuseur d’huiles essentielles', brand: 'Innobiz', cents: 6500 },
    { title: 'Coussin de méditation en épeautre', brand: 'Zafu', cents: 4900 },
  ],
};

const INTERESTS = [
  'Café', 'Céramique', 'Randonnée', 'Design', 'Vélo', 'Musique', 'Jardinage',
  'Lecture', 'Cuisine', 'Voyage', 'Photographie', 'Yoga', 'Escalade', 'Thé',
  'Mode', 'Méditation', 'Bijoux', 'Cinéma',
];

const FIRST = ['Camille', 'Léa', 'Hugo', 'Jade', 'Noah', 'Manon', 'Louis', 'Chloé',
  'Gabriel', 'Alice', 'Raphaël', 'Inès', 'Adam', 'Sarah', 'Paul', 'Nina',
  'Arthur', 'Zoé', 'Maël', 'Lina', 'Théo', 'Rose', 'Sacha', 'Anna'];
const LAST = ['Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre',
  'Leroy', 'Roux', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert',
  'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Faure'];

const COLORS = ['#FF6A55', '#6C5CE7', '#00B894', '#FDCB6E', '#0984E3', '#E17055', '#00CEC9'];

const OCCASIONS = ['Anniversaire', 'Noël', 'Crémaillère', 'Liste de naissance', null];

/** Free-text wishes with no product behind them. Invisible to the CF. */
const FREE_WISHES = [
  'Un week-end en Islande',
  'Des cours de poterie',
  'Un abonnement au théâtre',
  'Une journée au spa',
  'Un billet pour un concert',
];

/* ── Generation ──────────────────────────────────────────────────────────── */

async function main() {
  console.log('Suppression des données synthétiques précédentes…');
  await db.giftEvent.deleteMany({ where: { source: TAG } });
  await db.user.deleteMany({ where: { email: { endsWith: '@synth.kado.app' } } });
  await db.product.deleteMany({ where: { sourceUrl: { contains: '/synth/' } } });
  await db.merchant.deleteMany({ where: { slug: { in: MERCHANTS.map((m) => m.slug) } } });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ── Merchants ──
  const merchants = [];
  for (const m of MERCHANTS) {
    merchants.push(await db.merchant.create({ data: m }));
  }
  console.log(`${merchants.length} marchands`);

  // ── Products, through the real catalogue keys ──
  //
  // urlNorm/urlHash/titleKey are computed with the production functions rather
  // than made up, so the dedup indexes are exercised by this data exactly as
  // they would be by a real paste.
  const products: { id: string; categoryId: string; cents: number }[] = [];
  for (const [categoryId, items] of Object.entries(PRODUCTS)) {
    for (const item of items) {
      const merchant = pick(merchants);
      const slug = titleKey(item.title)!.replace(/ /g, '-').slice(0, 60);
      const url = `https://${merchant.domains[0]}/synth/${slug}`;
      const norm = normalizeUrl(url)!;

      const product = await db.product.create({
        data: {
          merchantId: merchant.id,
          title: item.title,
          brand: item.brand,
          description: `${item.title}. ${item.brand}. Livraison gratuite dès 49 €.`,
          sourceUrl: url,
          urlNorm: norm,
          urlHash: urlHash(norm),
          titleKey: titleKey(item.title),
          priceCents: item.cents,
          priceBand: priceBand(item.cents),
          categoryId,
          extractedBy: 'json-ld',
        },
      });
      products.push({ id: product.id, categoryId, cents: item.cents });
    }
  }
  console.log(`${products.length} produits dans ${Object.keys(PRODUCTS).length} catégories`);

  // ── Users, with interests that the taxonomy can actually resolve ──
  const users: { id: string; categories: string[] }[] = [];
  for (let i = 0; i < 40; i++) {
    const first = FIRST[i % FIRST.length]!;
    const last = pick(LAST);

    // Two or three interests, kept only if the taxonomy maps them — otherwise
    // content_facet would have nothing to work with for that person and the
    // demo would show an empty tier for no visible reason.
    const chosen = new Set<string>();
    while (chosen.size < int(2, 3)) chosen.add(pick(INTERESTS));
    const labels = [...chosen].filter((l) => categoriesForInterest(l).length > 0);
    if (labels.length === 0) labels.push('Café');

    const categories = [...new Set(labels.flatMap((l) => categoriesForInterest(l)))];

    const user = await db.user.create({
      data: {
        // De-accented: the login validator rejects accented characters in an
        // address, so `léa1@…` created an account that could never sign in —
        // 11 of 40 on the first run. The row was valid, the form refused it
        // before the password was ever checked.
        email: `${slugifyName(first)}${i}@synth.kado.app`,
        passwordHash,
        name: `${first} ${last}`,
        bio: `${labels.join(', ')}.`,
        birthday: daysAgo(int(7000, 18000)),
        profilePublic: rnd() < 0.3,
        interests: { create: labels.map((label) => ({ label })) },
      },
    });
    users.push({ id: user.id, categories });
  }
  console.log(`${users.length} utilisateurs`);

  // ── Friendships: a connected graph, not a uniform mesh ──
  let friendships = 0;
  for (let i = 0; i < users.length; i++) {
    // Chain so nobody is isolated, plus a few random edges for texture.
    const partners = new Set<number>();
    partners.add((i + 1) % users.length);
    for (let k = 0; k < int(1, 4); k++) partners.add(int(0, users.length - 1));
    partners.delete(i);

    for (const j of partners) {
      const [a, b] = i < j ? [i, j] : [j, i];
      try {
        await db.friendship.create({
          data: { requesterId: users[a]!.id, addresseeId: users[b]!.id, status: 'ACCEPTED' },
        });
        friendships += 1;
      } catch {
        // Already exists — the unique index is doing its job.
      }
    }
  }
  console.log(`${friendships} amitiés`);

  // ── Lists and gifts ──
  let giftCount = 0;
  let linkedCount = 0;
  const allGifts: { id: string; productId: string | null; ownerId: string; cents: number | null }[] = [];

  for (const user of users) {
    for (let l = 0; l < int(1, 2); l++) {
      const list = await db.giftList.create({
        data: {
          ownerId: user.id,
          name: l === 0 ? 'Mes envies' : pick(['Anniversaire', 'Noël', 'Cadeaux utiles']),
          occasion: pick(OCCASIONS),
          visibility: rnd() < 0.85 ? 'FRIENDS' : 'PUBLIC',
          isDefault: l === 0,
        },
      });

      for (let g = 0; g < int(2, 6); g++) {
        // One wish in six is free text with no product — a real proportion,
        // and those rows are invisible to collaborative filtering.
        const freeText = rnd() < 0.17;

        if (freeText) {
          const gift = await db.gift.create({
            data: {
              listId: list.id,
              name: pick(FREE_WISHES),
              priority: int(1, 3),
              priceCents: rnd() < 0.5 ? int(50, 400) * 100 : null,
            },
          });
          allGifts.push({ id: gift.id, productId: null, ownerId: user.id, cents: gift.priceCents });
        } else {
          // Products from the categories this person's interests resolve to,
          // so wishes are coherent with the profile rather than random.
          const inTaste = products.filter((p) => user.categories.includes(p.categoryId));
          const product = pick(inTaste.length > 0 ? inTaste : products);

          const gift = await db.gift.create({
            data: {
              listId: list.id,
              name: PRODUCTS[product.categoryId]!.find((x) => x.cents === product.cents)?.title
                ?? 'Cadeau',
              productId: product.id,
              priceCents: product.cents,
              category: product.categoryId,
              priority: int(1, 3),
            },
          });
          allGifts.push({ id: gift.id, productId: product.id, ownerId: user.id, cents: product.cents });
          linkedCount += 1;
        }
        giftCount += 1;
      }
    }
  }
  console.log(`${giftCount} cadeaux (${linkedCount} liés à un produit, ${giftCount - linkedCount} en texte libre)`);

  // ── Reservations and pot contributions, by friends only ──
  //
  // Each writes the same server-side event the real action would, so the
  // gifting log is coherent with the rows — but the total is capped well below
  // the CF threshold on purpose.
  const friendsOf = new Map<string, string[]>();
  for (const f of await db.friendship.findMany({ where: { status: 'ACCEPTED' } })) {
    friendsOf.set(f.requesterId, [...(friendsOf.get(f.requesterId) ?? []), f.addresseeId]);
    friendsOf.set(f.addresseeId, [...(friendsOf.get(f.addresseeId) ?? []), f.requesterId]);
  }

  let reservations = 0;
  let contributions = 0;
  const events: Prisma.GiftEventCreateManyInput[] = [];

  for (const gift of allGifts) {
    const friends = friendsOf.get(gift.ownerId) ?? [];
    if (friends.length === 0) continue;

    // Expensive gifts are the ones a friend is likely to open to the others,
    // which is the decision the model now puts in their hands.
    const opensToOthers = (gift.cents ?? 0) > 15000 && rnd() < 0.25;

    if (opensToOthers) {
      if (rnd() < 0.6) {
        // A pot is a reservation its holder opened, so the holder has to
        // exist before anybody can contribute — otherwise the contributions
        // hang off a gift nobody claimed and no friend can see the pot.
        const holder = pick(friends);
        const openedAt = daysAgo(int(1, 120));
        try {
          await db.reservation.create({
            data: {
              giftId: gift.id,
              reserverId: holder,
              openedToOthers: true,
              openedAt,
              createdAt: openedAt,
            },
          });
          reservations += 1;
        } catch {
          /* already reserved — fine */
        }

        for (let c = 0; c < int(1, 3); c++) {
          const contributor = pick(friends);
          const amount = Math.min(gift.cents ?? 5000, int(10, 60) * 100);
          try {
            await db.potContribution.create({
              data: { giftId: gift.id, contributorId: contributor, amountCents: amount },
            });
            events.push({
              actorId: contributor,
              kind: 'contribute',
              recipientId: gift.ownerId,
              giftId: gift.id,
              productId: gift.productId,
              priceCents: amount,
              weight: WEIGHTS.contribute,
              occurredAt: daysAgo(int(1, 120)),
              source: TAG,
            });
            contributions += 1;
          } catch {
            /* duplicate — fine */
          }
        }
      }
    } else if (rnd() < 0.28) {
      const reserver = pick(friends);
      try {
        await db.reservation.create({ data: { giftId: gift.id, reserverId: reserver } });
        events.push({
          actorId: reserver,
          kind: 'reserve',
          recipientId: gift.ownerId,
          giftId: gift.id,
          productId: gift.productId,
          priceCents: gift.cents,
          weight: WEIGHTS.reserve,
          occurredAt: daysAgo(int(1, 120)),
          source: TAG,
        });
        reservations += 1;
      } catch {
        /* already reserved — the unique index doing its job */
      }
    }

    // add_wish is evidence about the ADDER, with no recipient.
    events.push({
      actorId: gift.ownerId,
      kind: 'add_wish',
      giftId: gift.id,
      productId: gift.productId,
      priceCents: gift.cents,
      weight: WEIGHTS.add_wish,
      occurredAt: daysAgo(int(5, 200)),
      source: TAG,
    });
  }

  // ── Browsing telemetry: the kinds a client is allowed to log ──
  for (const user of users) {
    const seen = new Set<string>();
    for (let v = 0; v < int(5, 25); v++) {
      const product = pick(products);
      const key = `${user.id}:${product.id}`;
      if (seen.has(key)) continue; // one view per session, as the real cap does
      seen.add(key);
      events.push({
        actorId: user.id,
        kind: rnd() < 0.8 ? 'view_product' : 'click_out',
        productId: product.id,
        priceCents: product.cents,
        weight: rnd() < 0.8 ? WEIGHTS.view_product : WEIGHTS.click_out,
        sessionId: `${TAG}-${user.id.slice(-6)}`,
        occurredAt: daysAgo(int(0, 90)),
        source: TAG,
      });
    }
  }

  for (let i = 0; i < events.length; i += 500) {
    await db.giftEvent.createMany({ data: events.slice(i, i + 500), skipDuplicates: true });
  }
  console.log(`${reservations} réservations, ${contributions} contributions`);
  console.log(`${events.length} événements`);

  // ── The assertion this whole script is shaped around ──
  // Every generated account must actually be able to sign in. A dataset whose
  // logins are refused by the form is worse than no dataset: the rows look
  // right in the database and the app rejects them, which sends you hunting in
  // the wrong place. Found the hard way — 11 of 40 accounts on the first run.
  const created = await db.user.findMany({
    where: { email: { endsWith: '@synth.kado.app' } },
    select: { email: true },
  });
  const unusable = created.filter(
    (u) => !loginSchema.safeParse({ email: u.email, password: DEMO_PASSWORD }).success,
  );
  if (unusable.length > 0) {
    throw new Error(
      `${unusable.length} comptes générés ne passent pas la validation de connexion : ` +
        `${unusable.slice(0, 5).map((u) => u.email).join(', ')}. ` +
        `Ils existent en base mais le formulaire les refuse.`,
    );
  }
  console.log(`${created.length} comptes vérifiés connectables`);

  const gifting = await db.giftEvent.count({
    where: { kind: { in: ['reserve', 'purchase', 'contribute'] }, productId: { not: null } },
  });

  if (gifting >= CF_READY_THRESHOLD) {
    throw new Error(
      `Ce jeu a produit ${gifting} événements de don, au-dessus du seuil CF ` +
        `(${CF_READY_THRESHOLD}). Le palier cf_item se déclencherait sur des ` +
        `corrélations inventées ici, ce qui est exactement le non-sens confiant ` +
        `que la phase 5 cherche à éviter. Réduisez le volume.`,
    );
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Événements de don : ${gifting} / ${CF_READY_THRESHOLD} (seuil CF)`);
  console.log('cf_item reste SILENCIEUX — voulu : ces données sont inventées,');
  console.log('et un CF entraîné dessus produirait du non-sens confiant.');
  console.log('content_facet et popularity, eux, ont de quoi travailler.');
  console.log('─────────────────────────────────────────');
  console.log(`\nComptes : prénom+index@synth.kado.app — mot de passe : ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
