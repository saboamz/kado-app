-- Records that somebody closed the getting-started checklist.
--
-- Whether each step is done is derived from the data — a stored flag would
-- say "wish added" after the wish was deleted. Dismissal is the exception:
-- it is a decision, not a fact about the account, so nothing else records it.
ALTER TABLE "User" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);
