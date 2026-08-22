# Kado

> Des listes de souhaits que vos proches remplissent en secret.

A real wishlist application: accounts, friends, lists, reservations and
collaborative pots, backed by Postgres.

## The rule this application is built around

**A list owner never learns that one of their gifts has been reserved.** Not
who reserved it, not how many are taken, not that anything happened at all.

Hiding it in the interface is not enough — the data would still be in the JSON
payload for anyone who opens devtools. So the rule lives at the boundary where
database rows become API responses, in [`src/lib/secrecy.ts`](src/lib/secrecy.ts):

- For an owner, `giftInclude('owner')` returns `{}`, so reservation and
  contribution rows are **never fetched**.
- For an owner, `viewGift()` omits the `reservation` and `pot` keys entirely —
  not emptied, not zeroed, absent.

The consequence is testable and tested: an owner's payload for a reserved gift
is **byte-for-byte identical** to the payload for a free one. They cannot tell
the difference, because there is no difference.

## Getting started

```bash
npm install
cp .env.example .env
npm run db:up        # Postgres via Docker
npm run db:migrate   # apply migrations
npm run db:seed      # demo accounts and data
npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Lint |
| `npm run typecheck` | Typecheck without emitting |
| `npm test` | Run the test suite |
| `npm run db:up` / `db:down` | Start / stop Postgres |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Browse the database |
| `npm run db:reset` | Drop, re-migrate and re-seed |

## Data model

`User` · `Session` · `Interest` · `GiftList` · `Gift` · `Reservation` ·
`PotContribution` · `Friendship` · `Notification` · `ChatMessage`

`Reservation`, `PotContribution` and `ChatMessage` are the tables the owner must
never see. They are documented as such in
[`prisma/schema.prisma`](prisma/schema.prisma).

## Deploying to Vercel

Free tier throughout: Vercel (Hobby), Neon (Free), Vercel Blob (Hobby).

**Neon rather than a plain Postgres** because the schema requires `pgvector`
(`Product.embedding`), and because its pooler is what keeps a serverless
deployment from exhausting the connection limit.

1. **Database.** Create a Neon project. Take both connection strings:
   - `DATABASE_URL` — the **pooled** one (`...-pooler.<region>.aws.neon.tech`),
     with `?sslmode=require&pgbouncer=true&connection_limit=1` appended.
     Every function instance holds its own pool, so each needs the smallest
     one that works, with PgBouncer multiplexing in front.
   - `DIRECT_URL` — the same host **without** `-pooler`. Migrations run through
     this: PgBouncer in transaction mode cannot carry the session state that
     DDL and advisory locks need.

2. **Image storage.** `vercel blob store add`, then set the
   `BLOB_READ_WRITE_TOKEN` it prints. Its presence is what switches storage
   from the local disk to Blob — on Vercel the function filesystem is
   ephemeral and unshared, so a locally-written file is gone on the next
   request and was never visible to another instance.

3. **Secrets.** Set `CRON_SECRET`, 32 random bytes:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Deploy.** Vercel runs `vercel-build`, which generates the Prisma client,
   applies migrations and builds. Nothing else to configure.

The nightly cron (`vercel.json`, 03:00) recomputes product popularity and the
item-item similarity matrix, and purges expired rate-limit rows. Embeddings
stay a manual `npm run embed`: the encoder is a 400 MB model that does not fit
a serverless function.

### Deploying with Docker instead

Unchanged and still supported. The `Dockerfile` builds a standalone server and
a separate migration stage; `UPLOAD_DIR` points at a mounted volume, and with
no `BLOB_READ_WRITE_TOKEN` set the app writes images there.

## Contributing

`main` is protected; every change lands through a pull request.
