import { PrismaClient } from '@prisma/client';

/**
 * Removes rows created by end-to-end runs, leaving the seed untouched.
 *
 * `prisma migrate reset` would also do it, but that drops the whole database:
 * far too blunt when all you want is to undo a test run.
 */
const db = new PrismaClient();

async function main() {
  const users = await db.user.deleteMany({
    where: { email: { contains: '@example.com' } },
  });
  const lists = await db.giftList.deleteMany({
    where: { name: { startsWith: 'Test ' } },
  });
  const gifts = await db.gift.deleteMany({
    where: {
      OR: [
        { name: { contains: 'Théière' } },
        { name: { contains: 'Idée libre' } },
        { name: { contains: 'Prix douteux' } },
      ],
    },
  });

  console.log(
    `Removed ${users.count} test users, ${lists.count} test lists, ${gifts.count} test gifts.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
