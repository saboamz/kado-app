-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AgeBracket" AS ENUM ('AGE_15_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55_64', 'AGE_65_PLUS');

-- AlterTable
-- Both nullable, and they stay nullable: NULL is the answer "I would rather
-- not say", which is a real answer and must not be forced into a category.
ALTER TABLE "User" ADD COLUMN "gender" "Gender";
ALTER TABLE "User" ADD COLUMN "ageBracket" "AgeBracket";
