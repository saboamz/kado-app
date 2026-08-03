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

## Contributing

`main` is protected; every change lands through a pull request.
