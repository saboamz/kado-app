import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const db = new PrismaClient();

/** Every demo account shares this password so the app is easy to try. */
const DEMO_PASSWORD = 'kado1234';

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function main() {
  console.log('Resetting demo data…');
  // Order matters only where cascades do not cover us; deleting users cascades
  // to sessions, lists, gifts, reservations, contributions and messages.
  await db.notification.deleteMany();
  await db.friendship.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  console.log('Creating accounts…');
  const sophie = await db.user.create({
    data: {
      email: 'sophie@kado.app',
      passwordHash,
      name: 'Sophie Marchand',
      bio: 'Café filtre, céramique et randonnées.',
      birthday: daysFromNow(12),
      interests: {
        create: [
          { label: 'Céramique' },
          { label: 'Café' },
          { label: 'Randonnée' },
          { label: 'Design' },
        ],
      },
    },
  });

  const thomas = await db.user.create({
    data: {
      email: 'thomas@kado.app',
      passwordHash,
      name: 'Thomas Bel',
      bio: 'Vélo, cuisine et vieux synthés.',
      birthday: daysFromNow(24),
      interests: { create: [{ label: 'Vélo' }, { label: 'Musique' }] },
    },
  });

  const emma = await db.user.create({
    data: {
      email: 'emma@kado.app',
      passwordHash,
      name: 'Emma Roux',
      bio: 'Jardinage et romans policiers.',
      birthday: daysFromNow(45),
      interests: { create: [{ label: 'Jardinage' }, { label: 'Lecture' }] },
    },
  });

  const lucas = await db.user.create({
    data: {
      email: 'lucas@kado.app',
      passwordHash,
      name: 'Lucas Ferrand',
      bio: 'Jeux de société et photographie argentique.',
      birthday: daysFromNow(80),
    },
  });

  console.log('Connecting friends…');
  await db.friendship.createMany({
    data: [
      { requesterId: thomas.id, addresseeId: sophie.id, status: 'ACCEPTED' },
      { requesterId: emma.id, addresseeId: sophie.id, status: 'ACCEPTED' },
      { requesterId: sophie.id, addresseeId: lucas.id, status: 'ACCEPTED' },
      { requesterId: thomas.id, addresseeId: emma.id, status: 'ACCEPTED' },
      // Pending, so the friend-request UI has something real to act on.
      { requesterId: lucas.id, addresseeId: thomas.id, status: 'PENDING' },
    ],
  });

  console.log('Creating lists and gifts…');
  const birthday = await db.giftList.create({
    data: {
      name: 'Anniversaire',
      occasion: 'Anniversaire',
      ownerId: sophie.id,
      isDefault: true,
      gifts: {
        create: [
          {
            name: 'AirPods Pro 3',
            description:
              "Réduction de bruit active. Taille d'embouts M, version USB-C de préférence.",
            priceCents: 27900,
            merchant: 'Apple Store',
            url: 'https://www.apple.com/fr/airpods-pro/',
            category: 'Tech',
            priority: 3,
          },
          {
            name: 'Cafetière Chemex 6 tasses',
            description: 'Modèle classique en verre, avec les filtres blancs.',
            priceCents: 5200,
            merchant: 'La Brûlerie',
            url: 'https://labrulerie.fr/chemex-6',
            category: 'Maison',
            priority: 2,
          },
          {
            name: 'MacBook Air 15″ M4',
            description: 'Couleur minuit, 16 Go de mémoire.',
            priceCents: 159900,
            merchant: 'Apple Store',
            url: 'https://www.apple.com/fr/macbook-air/',
            category: 'Tech',
            priority: 3,
          },
          {
            name: 'Vase en grès émaillé',
            description: 'Atelier français, teinte sable, environ 25 cm.',
            priceCents: 6800,
            merchant: 'Sessùn',
            url: 'https://www.sessun.com/vase-gres',
            category: 'Maison',
            priority: 1,
          },
          {
            name: 'Sac de randonnée 30 L',
            description: 'Dos ventilé, coloris sombre.',
            priceCents: 13500,
            merchant: 'Décathlon',
            url: 'https://www.decathlon.fr/mh500-30l',
            category: 'Sport',
            priority: 2,
          },
        ],
      },
    },
    include: { gifts: true },
  });

  await db.giftList.create({
    data: {
      name: 'Maison',
      ownerId: sophie.id,
      gifts: {
        create: [
          {
            name: 'Plaid en laine',
            priceCents: 8900,
            category: 'Maison',
            priority: 2,
          },
          {
            name: 'Lampe de bureau articulée',
            priceCents: 12000,
            category: 'Maison',
            priority: 1,
          },
        ],
      },
    },
  });

  // An empty list, so the empty state is reachable without faking it.
  await db.giftList.create({
    data: { name: 'Crémaillère', occasion: 'Crémaillère', ownerId: sophie.id },
  });

  await db.giftList.create({
    data: {
      name: 'Anniversaire',
      occasion: 'Anniversaire',
      ownerId: thomas.id,
      isDefault: true,
      gifts: {
        create: [
          {
            name: 'Casque Sony WH-1000XM6',
            priceCents: 39900,
            category: 'Tech',
            priority: 3,
          },
          {
            name: 'Week-end en Islande',
            description: 'Trois nuits près de Reykjavík, plutôt en février.',
            priceCents: 124000,
            category: 'Voyage',
            priority: 2,
          },
        ],
      },
    },
  });

  console.log('Reserving gifts (invisible to their owners)…');
  const airpods = birthday.gifts.find((g) => g.name === 'AirPods Pro 3')!;
  const chemex = birthday.gifts.find((g) =>
    g.name.startsWith('Cafetière'),
  )!;
  const macbook = birthday.gifts.find((g) => g.name.startsWith('MacBook'))!;

  await db.reservation.create({
    data: { giftId: airpods.id, reserverId: thomas.id },
  });
  await db.reservation.create({
    data: { giftId: chemex.id, reserverId: emma.id },
  });

  // The MacBook is a pot because Thomas reserved it and then opened it to the
  // others — the model now, rather than a flag the owner set.
  await db.reservation.create({
    data: {
      giftId: macbook.id,
      reserverId: thomas.id,
      openedToOthers: true,
      openedAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
  });

  await db.potContribution.createMany({
    data: [
      { giftId: macbook.id, contributorId: thomas.id, amountCents: 30000 },
      { giftId: macbook.id, contributorId: emma.id, amountCents: 25000 },
      { giftId: macbook.id, contributorId: lucas.id, amountCents: 10000 },
    ],
  });

  console.log('Adding secret chat…');
  await db.chatMessage.createMany({
    data: [
      {
        giftId: macbook.id,
        authorId: thomas.id,
        body: "Je mets 300 €. Quelqu'un complète ?",
        createdAt: daysAgo(2),
      },
      {
        giftId: macbook.id,
        authorId: emma.id,
        body: 'Je peux faire 250 €.',
        createdAt: daysAgo(1),
      },
      {
        giftId: macbook.id,
        authorId: lucas.id,
        body: '100 € de mon côté. On y est presque.',
        createdAt: daysAgo(1),
      },
    ],
  });

  console.log('Adding notifications…');
  await db.notification.createMany({
    data: [
      {
        userId: sophie.id,
        type: 'BIRTHDAY_SOON',
        body: 'Thomas fête son anniversaire dans 24 jours.',
        href: '/u/' + thomas.id,
      },
      {
        userId: sophie.id,
        type: 'NEW_LIST',
        body: 'Emma a créé une nouvelle liste.',
      },
      {
        userId: thomas.id,
        type: 'FRIEND_REQUEST',
        body: 'Lucas Ferrand souhaite devenir votre ami.',
        href: '/friends',
      },
      {
        userId: thomas.id,
        type: 'POT_PROGRESS',
        body: 'La cagnotte du MacBook progresse.',
      },
    ],
  });

  const counts = {
    users: await db.user.count(),
    lists: await db.giftList.count(),
    gifts: await db.gift.count(),
    reservations: await db.reservation.count(),
    contributions: await db.potContribution.count(),
  };
  console.log('Seed complete:', counts);
  console.log(`\nSign in with any of these — password: ${DEMO_PASSWORD}`);
  console.log('  sophie@kado.app   (owner of the demo lists)');
  console.log('  thomas@kado.app   (friend, has reserved the AirPods)');
  console.log('  emma@kado.app     (friend, has reserved the Chemex)');
  console.log('  lucas@kado.app    (friend, contributed to the pot)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
