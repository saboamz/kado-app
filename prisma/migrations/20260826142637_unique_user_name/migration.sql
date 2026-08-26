-- The username becomes unique.
--
-- Hand-written, because the generated version would add a NOT NULL column to
-- a table that already has rows and stop there. Four steps: add the column
-- nullable, derive it from the name with the SAME rule nameKey() applies in
-- TypeScript (lower, trim, inner spaces collapsed — see src/lib/name-key.ts),
-- rename the accounts whose names collide once compared, then lock it down.

-- 1. The column, nullable for the moment: existing rows have nothing in it.
ALTER TABLE "User" ADD COLUMN "nameKey" TEXT;

-- 2. Derived from the name, identically to nameKey() in TypeScript.
UPDATE "User"
SET "nameKey" = lower(btrim(regexp_replace("name", '\s+', ' ', 'g')));

-- 3. Collisions. The oldest account keeps the name; every later one gets a
--    numeric suffix on BOTH the shown name and its key, so the two never
--    disagree. (A suffixed name colliding with a literal "sophie 2" would
--    make step 4 fail loudly rather than corrupt anything — acceptable odds.)
WITH ranked AS (
  SELECT "id",
         row_number() OVER (PARTITION BY "nameKey" ORDER BY "createdAt", "id") AS rn
  FROM "User"
)
UPDATE "User" u
SET "name"    = u."name"    || ' ' || r.rn,
    "nameKey" = u."nameKey" || ' ' || r.rn
FROM ranked r
WHERE u."id" = r."id" AND r.rn > 1;

-- 4. Every row has one, no two share it.
ALTER TABLE "User" ALTER COLUMN "nameKey" SET NOT NULL;
CREATE UNIQUE INDEX "User_nameKey_key" ON "User"("nameKey");
