-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'simple',
    "pointsByRank" TEXT,
    "stagePointsByRank" TEXT,
    "stageTtMultiplier" INTEGER NOT NULL DEFAULT 1,
    "generalPointsByRank" TEXT,
    "jerseyPointsByRank" TEXT
);
INSERT INTO "new_Category" ("id", "name", "pointsByRank") SELECT "id", "name", "pointsByRank" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE TABLE "new_Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "season" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "resultKind" TEXT NOT NULL DEFAULT 'race',
    "parentRaceId" TEXT,
    "stageNumber" INTEGER,
    "isTimeTrial" BOOLEAN NOT NULL DEFAULT false,
    "jerseyName" TEXT,
    CONSTRAINT "Race_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Race_parentRaceId_fkey" FOREIGN KEY ("parentRaceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Race" ("categoryId", "date", "id", "name", "season") SELECT "categoryId", "date", "id", "name", "season" FROM "Race";
DROP TABLE "Race";
ALTER TABLE "new_Race" RENAME TO "Race";
CREATE INDEX "Race_season_idx" ON "Race"("season");
CREATE INDEX "Race_parentRaceId_idx" ON "Race"("parentRaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
