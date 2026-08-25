import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

/**
 * Locks the demo accounts out of a database, without deleting them.
 *
 * The seed's accounts (sophie@kadlio.app, thomas@kadlio.app, …) share a
 * password that was printed on the login page for weeks and lives in the git
 * history forever. In development that is the point; in production it is an
 * open door — and now that the app sends e-mail, an open door on addresses
 * that have no mailbox behind them, which a stranger could use to generate
 * hard bounces against our sending domain's reputation.
 *
 * Each account gets its own fresh 32 bytes of CSPRNG as a password nobody
 * ever sees, hashed the way src/lib/password.ts hashes (scrypt N=2^15, same
 * format string), so the rows, lists and demo content survive but the
 * credentials die. Deleting the accounts would also work; this keeps the
 * option of a working demo open.
 *
 * Run ONCE against production:
 *   DATABASE_URL="<prod url>" npx tsx prisma/neutralize-demo.ts
 */
const db = new PrismaClient();

function scryptHash(password: string): string {
  // Mirrors hashPassword() in src/lib/password.ts exactly —
  // scrypt:<N>:<r>:<p>:<saltHex>:<hashHex> at the current cost — duplicated
  // here so this one-shot script does not reach into src/ and quietly couple
  // the app to its own maintenance tools.
  const salt = randomBytes(16);
  const N = 131072;
  const hash = scryptSync(password, salt, 64, { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return `scrypt:${N}:8:1:${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function main() {
  const demo = await db.user.findMany({
    where: { email: { endsWith: '@kadlio.app' } },
    select: { id: true, email: true },
  });

  for (const user of demo) {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: scryptHash(randomBytes(32).toString('base64url')) },
      }),
      // A session or a reset link issued before this run must die with the
      // old password, or the lockout is theatre.
      db.session.deleteMany({ where: { userId: user.id } }),
      db.passwordReset.deleteMany({ where: { userId: user.id } }),
    ]);
    console.log(`neutralized ${user.email}`);
  }
  console.log(`${demo.length} demo account(s) locked out`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
