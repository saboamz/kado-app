-- A shareable link that turns into a friendship.
--
-- Joining took five steps — get the URL some other way, sign up, search for a
-- name, send a request, wait for acceptance. Most people stop partway, and an
-- app whose whole point is what friends do behind your back stays empty.
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE INDEX "Invite_ownerId_idx" ON "Invite"("ownerId");

ALTER TABLE "Invite" ADD CONSTRAINT "Invite_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
