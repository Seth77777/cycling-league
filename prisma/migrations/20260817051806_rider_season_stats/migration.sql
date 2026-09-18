-- CreateTable
CREATE TABLE "RiderSeasonStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "age" INTEGER,
    "potential" INTEGER,
    "moyenne" REAL,
    "statPl" INTEGER,
    "statMo" INTEGER,
    "statVal" INTEGER,
    "statClm" INTEGER,
    "statPrl" INTEGER,
    "statPav" INTEGER,
    "statSp" INTEGER,
    "statAcc" INTEGER,
    "statDes" INTEGER,
    "statBar" INTEGER,
    "statEnd" INTEGER,
    "statRes" INTEGER,
    "statRec" INTEGER,
    CONSTRAINT "RiderSeasonStats_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderSeasonStats_riderId_season_key" ON "RiderSeasonStats"("riderId", "season");
