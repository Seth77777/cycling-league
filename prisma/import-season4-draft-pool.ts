// Season 4 draft pool — prospects eligible for the draft (draftSeason = 4) but not yet
// picked by any team (draftPick stays null, no TeamStint). The user will report picks
// later via prisma/import-season4-draft.ts once teams have actually chosen.
//
// Moyenne is computed here (mean of the 13 stats) rather than trusted from the pasted
// data, per explicit instruction — the source numbers can drift from a true average.
import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const STAT_KEYS = ["statPl", "statMo", "statVal", "statClm", "statPrl", "statPav", "statSp", "statAcc", "statDes", "statBar", "statEnd", "statRes", "statRec"] as const;

// Nom \t Prénom \t Pays \t Âge \t POT \t PL MO VAL CLM PRL PAV SP ACC DES BAR END RES REC \t MOY (MOY column ignored, recomputed)
const RAW = `
Van Kesbruck	Daryl	AFS	20	5	75	58	68	51	53	64	71	73	71	70	73	72	74	67,15
Velasquez Castro	Jamon	MEX	20	5	70	68	72	53	58	67	74	73	75	69	74	62	50	66,54
Almirez	Luis	ESP	21	5	57	67	71	60	69	69	70	57	66	74	70	63	62	65,77
Ferrari	Giovanni	ITA	22	6	71	77	59	73	60	59	70	71	71	55	76	52	61	65,77
Edelin	Yusuf	TUR	19	8	63	70	51	55	57	71	74	68	67	56	74	67	72	65,00
Basteiner	Stefan	ALL	19	6	59	69	61	74	56	64	54	67	70	72	58	68	70	64,77
Kowalski	Robert	POL	21	8	67	73	68	59	54	73	73	52	63	60	67	75	58	64,77
Novotny	Tomas	RTC	22	2	57	59	59	67	59	62	71	54	77	57	77	67	75	64,69
Webb	Adam	AUS	19	3	69	70	68	54	50	71	56	72	64	66	64	62	73	64,54
Pavalodov	Ivan	BUL	21	4	70	72	74	62	59	56	65	53	66	60	73	63	65	64,46
Delage	Axel	FRA	20	5	75	61	60	68	70	64	67	70	60	63	50	72	51	63,92
Park	Su-Yong	COR	22	4	72	66	58	58	58	58	50	70	60	73	73	59	75	63,85
Svaticic	Luka	CRO	20	5	74	58	64	59	50	72	63	66	71	59	70	53	71	63,85
Weber	Jerome	LUX	23	4	70	59	68	73	53	65	58	72	67	68	57	63	57	63,85
Yarakov	Aleksandr	KAZ	22	7	65	51	67	59	66	77	62	57	76	63	59	70	57	63,77
Ninha	Roberto	BRE	21	4	68	76	64	70	50	68	68	69	55	72	54	56	57	63,62
Quintero	Dayer	COL	21	8	76	53	60	51	68	69	57	62	52	73	72	60	69	63,23
Wang	Zuo	CHI	21	1	74	59	59	63	75	67	56	50	69	59	69	57	60	62,85
Handford	Kylian	GBR	21	4	61	56	73	50	72	74	51	70	53	52	55	72	74	62,54
Hagersson	Edvald	NOR	23	6	67	69	69	56	55	52	66	74	59	56	78	58	52	62,38
Miller	Brandon	USA	21	1	55	60	65	64	59	73	60	58	72	69	74	52	50	62,38
Ragatoni	Gabriele	ITA	23	3	71	56	64	68	60	73	53	52	52	69	61	53	78	62,31
Vakynin	Yaril	UKR	20	7	71	62	73	63	67	53	59	64	51	72	51	52	69	62,08
Misawari	Fuji	JPN	18	2	50	58	66	73	62	73	52	53	61	68	56	70	63	61,92
Al Sawari	Ahmed	EGY	20	8	71	56	51	74	59	54	54	52	70	61	66	69	66	61,77
Christensen	Anker	DAN	19	4	58	69	68	58	52	69	68	65	56	62	52	66	60	61,77
Oliverio Garcia	Rui	POR	19	2	55	52	68	63	62	62	66	68	51	55	55	74	72	61,77
De Grasse	Albert	CAN	21	7	68	66	60	50	59	55	58	59	65	56	59	72	70	61,31
Felipe	Sergio	ARG	23	6	72	54	76	50	72	56	52	66	55	77	55	56	52	61,00
Agerstrom	Svet	SUE	20	2	59	60	63	59	65	62	59	50	63	60	61	67	60	60,62
Cerny	Matyas	RTC	19	4	53	56	53	67	58	65	66	64	63	51	64	62	65	60,54
Hammacht	Bastian	ALL	18	3	66	71	52	51	62	52	60	66	58	51	58	70	67	60,31
Kaspaev	Gaspar	RUS	19	5	74	58	62	62	50	59	64	68	52	57	59	51	66	60,15
Karagounis	Nikos	GRE	20	5	51	71	59	56	50	75	68	54	62	63	59	58	55	60,08
Peeters	Liam	BEL	18	8	63	59	60	72	50	54	65	56	53	70	58	50	68	59,85
`.trim();

const SEASON = 4;

async function main() {
  const lines = RAW.split("\n");
  let created = 0;

  for (const line of lines) {
    const cols = line.split("\t");
    const [lastName, firstName, nationality, ageRaw, potentialRaw, ...rest] = cols;
    const stats = rest.slice(0, 13).map(Number);

    const existing = await prisma.rider.findFirst({ where: { firstName, lastName } });
    if (existing) {
      console.warn(`Already exists, skipping: ${firstName} ${lastName}`);
      continue;
    }

    const statData: Record<string, number> = {};
    STAT_KEYS.forEach((key, i) => { statData[key] = stats[i]; });
    const moyenne = Math.round((stats.reduce((a, b) => a + b, 0) / stats.length) * 100) / 100;

    await prisma.rider.create({
      data: {
        firstName,
        lastName,
        nationality,
        age: Number(ageRaw),
        potential: Number(potentialRaw),
        moyenne,
        draftSeason: SEASON,
        draftPick: null,
        ...statData,
      },
    });
    created++;
  }

  console.log(`Season ${SEASON} draft pool: created ${created} prospects (not yet picked).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
