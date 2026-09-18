/*
  Warnings:

  - You are about to drop the column `endDate` on the `TeamStint` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `TeamStint` table. All the data in the column will be lost.
  - Added the required column `startSeason` to the `TeamStint` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Rider" ADD COLUMN "age" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "moyenne" REAL;
ALTER TABLE "Rider" ADD COLUMN "potential" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statAcc" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statBar" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statClm" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statDes" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statEnd" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statMo" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statPav" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statPl" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statPrl" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statRec" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statRes" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statSp" INTEGER;
ALTER TABLE "Rider" ADD COLUMN "statVal" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamStint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "startSeason" INTEGER NOT NULL,
    "endSeason" INTEGER,
    CONSTRAINT "TeamStint_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamStint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamStint" ("id", "riderId", "teamId") SELECT "id", "riderId", "teamId" FROM "TeamStint";
DROP TABLE "TeamStint";
ALTER TABLE "new_TeamStint" RENAME TO "TeamStint";
CREATE INDEX "TeamStint_riderId_idx" ON "TeamStint"("riderId");
CREATE INDEX "TeamStint_teamId_idx" ON "TeamStint"("teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
