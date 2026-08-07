-- A GIF somebody put on their profile, in one of a fixed set of slots.
--
-- Only the fields we need are stored, from a provider we allowlist. A raw URL
-- from anywhere would make every visit to a profile a request to a server its
-- owner chose — a visitor tracker, on a page whose whole point is that people
-- cannot see what others are doing.
CREATE TABLE "ProfileDecoration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "gifUrl" TEXT NOT NULL,
    "stillUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "title" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'giphy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileDecoration_pkey" PRIMARY KEY ("id")
);

-- One decoration per slot, per person: putting two GIFs in the banner is not
-- a state the page can render.
CREATE UNIQUE INDEX "ProfileDecoration_userId_slot_key" ON "ProfileDecoration"("userId", "slot");
CREATE INDEX "ProfileDecoration_userId_idx" ON "ProfileDecoration"("userId");

ALTER TABLE "ProfileDecoration" ADD CONSTRAINT "ProfileDecoration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
