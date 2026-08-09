-- Who actually went and bought the gift.
--
-- No money moves through this app: a contribution is a promise, and at the
-- end somebody is out of pocket for the whole amount. They were the one
-- person unable to see who owed them what.
--
-- Nullable: every pot open today has nobody declared, which is the state
-- where the breakdown stays hidden from everyone.
ALTER TABLE "Reservation" ADD COLUMN "purchasedById" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "purchasedAt" TIMESTAMP(3);

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_purchasedById_fkey"
  FOREIGN KEY ("purchasedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Reservation_purchasedById_idx" ON "Reservation"("purchasedById");
