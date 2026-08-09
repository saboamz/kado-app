-- What a pot is aiming at, as the person who opened it said.
--
-- Until now the target was the wish's own price, which meant a wish with no
-- price could never carry a completable pot. It also meant an estimated price
-- could not be used at all: a pot that "completes" against a guess tells
-- contributors they are done when they are not.
--
-- Nullable, and null for every existing pot: those keep reading the gift's
-- price exactly as they did, so nothing in flight changes.
ALTER TABLE "Reservation" ADD COLUMN "targetCents" INTEGER;
