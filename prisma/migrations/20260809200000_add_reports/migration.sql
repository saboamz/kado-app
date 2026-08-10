-- Somebody telling us a profile or a wish is not acceptable.
--
-- Nothing looks at what an uploaded photo contains, and automatic moderation
-- is either paid or a local model that costs seconds per upload and mistakes
-- a beach holiday for something else. A report is free and exact.
CREATE TABLE "Report" (
  "id"         TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "subjectId"  TEXT,
  "giftId"     TEXT,
  "reason"     TEXT NOT NULL,
  "handledAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- One report per person per thing: a second is noise, not a signal.
CREATE UNIQUE INDEX "Report_reporterId_subjectId_key" ON "Report"("reporterId", "subjectId");
CREATE UNIQUE INDEX "Report_reporterId_giftId_key" ON "Report"("reporterId", "giftId");
CREATE INDEX "Report_handledAt_idx" ON "Report"("handledAt");

ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_giftId_fkey"
  FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
