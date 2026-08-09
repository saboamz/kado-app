-- The language a person reads the app in.
--
-- Defaults to 'fr' so every existing account keeps exactly what it has today;
-- new accounts get a guess from Accept-Language at signup.
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr';
