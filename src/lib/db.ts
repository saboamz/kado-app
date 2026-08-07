import { PrismaClient } from '@prisma/client';

/**
 * The database client.
 *
 * ── Why the instance is cached in production too ───────────────────────────
 *
 * The cache used to be development-only, to stop Next's dev reloads from
 * opening a fresh pool on every edit. On a long-lived server that was enough:
 * one process, one client, one pool.
 *
 * Serverless breaks that assumption. Each function instance is its own
 * process, and a cold start that builds a new PrismaClient opens a new pool of
 * connections against Postgres. Under any real concurrency the instances
 * multiply, the pools multiply with them, and the database starts refusing
 * connections — a failure that appears only under load, which is to say only
 * in production. Reusing the client across invocations on a warm instance is
 * what keeps that bounded.
 *
 * ── And why connection_limit=1 belongs in the URL ──────────────────────────
 *
 * Even cached, every instance holds its own pool. The instances are what
 * scales, so each one needs the smallest pool that works — one connection —
 * and a pooler (PgBouncer, which Neon puts behind its `-pooler` host) in front
 * to multiplex them. The alternative is Prisma's default of a pool per
 * instance, which multiplies out to hundreds of connections against a database
 * whose free tier allows a few dozen.
 *
 * DIRECT_URL exists for the same reason in reverse: migrations must not run
 * through the pooler, because PgBouncer in transaction mode cannot carry the
 * session state that DDL and advisory locks need. Prisma reads it from the
 * schema's `directUrl`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = db;
