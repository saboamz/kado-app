-- The notifications that announced a birthday go with the column that fed
-- them. Deleted before the enum value is removed, because Postgres refuses to
-- drop a label any row still carries.
DELETE FROM "Notification" WHERE "type" = 'BIRTHDAY_SOON';

-- AlterEnum: BIRTHDAY_SOON becomes EVENT_SOON.
-- Postgres cannot remove a value from an enum in place, so the type is
-- rebuilt: create the new one, move the column across, drop the old.
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";

CREATE TYPE "NotificationType" AS ENUM (
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'NEW_LIST',
  'NEW_GIFTS',
  'EVENT_SOON',
  'POT_PROGRESS',
  'CHAT_MESSAGE'
);

ALTER TABLE "Notification"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING ("type"::text::"NotificationType");

DROP TYPE "NotificationType_old";

-- DropColumn: every stored date of birth is destroyed with it.
ALTER TABLE "User" DROP COLUMN "birthday";

-- CreateTable
CREATE TABLE "LifeEvent" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'FRIENDS',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LifeEvent_ownerId_idx" ON "LifeEvent"("ownerId");

-- AddForeignKey
ALTER TABLE "LifeEvent" ADD CONSTRAINT "LifeEvent_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
