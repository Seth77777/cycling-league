-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "order" INTEGER,
    "season" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "resultKind" TEXT NOT NULL DEFAULT 'race',
    "parentRaceId" TEXT,
    "stageNumber" INTEGER,
    "isTimeTrial" BOOLEAN NOT NULL DEFAULT false,
    "isTeamTimeTrial" BOOLEAN NOT NULL DEFAULT false,
    "jerseyName" TEXT,
    "logoUrl" TEXT,
    "profileUrl" TEXT,
    CONSTRAINT "Race_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Race_parentRaceId_fkey" FOREIGN KEY ("parentRaceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Race" ("categoryId", "country", "id", "isTimeTrial", "jerseyName", "logoUrl", "name", "order", "parentRaceId", "profileUrl", "resultKind", "season", "stageNumber") SELECT "categoryId", "country", "id", "isTimeTrial", "jerseyName", "logoUrl", "name", "order", "parentRaceId", "profileUrl", "resultKind", "season", "stageNumber" FROM "Race";
DROP TABLE "Race";
ALTER TABLE "new_Race" RENAME TO "Race";
CREATE INDEX "Race_season_idx" ON "Race"("season");
CREATE INDEX "Race_parentRaceId_idx" ON "Race"("parentRaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
