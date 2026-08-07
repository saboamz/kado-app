-- Moves "collaborative" from the gift to the reservation.
--
-- It used to be Gift.isPot, set by the list's owner when they added the wish.
-- Whether one friend buys the thing alone or several club together is a
-- decision among the friends, taken once they know the price and who else is
-- interested — and the owner must not learn the answer either way.

ALTER TABLE "Reservation"
  ADD COLUMN "openedToOthers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "openedAt" TIMESTAMP(3);

-- Carry over the pots that already have money in them.
--
-- An existing pot gift has contributions but, under the old model, no
-- Reservation at all: the two were mutually exclusive. Its earliest
-- contributor becomes the reservation holder, and the reservation is already
-- open — which is what they were doing in practice.
INSERT INTO "Reservation" ("id", "giftId", "reserverId", "openedToOthers", "openedAt", "createdAt")
SELECT
  gen_random_uuid()::text,
  c."giftId",
  (SELECT c2."contributorId"
     FROM "PotContribution" c2
    WHERE c2."giftId" = c."giftId"
    ORDER BY c2."createdAt" ASC
    LIMIT 1),
  true,
  MIN(c."createdAt"),
  MIN(c."createdAt")
FROM "PotContribution" c
WHERE NOT EXISTS (SELECT 1 FROM "Reservation" r WHERE r."giftId" = c."giftId")
GROUP BY c."giftId";

-- Pot gifts nobody funded simply become ordinary gifts: with no contributor
-- there is no one to make the holder, and nothing is lost — no money moved.
ALTER TABLE "Gift" DROP COLUMN "isPot";
