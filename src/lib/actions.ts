"use server";

import { prisma } from "@/lib/prisma";
import { parsePointsByRank, pointsForRank } from "@/lib/points";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

// ── Riders ──────────────────────────────────────────────────────────────────

export async function createRider(formData: FormData) {
  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const nationality = str(formData, "nationality") || null;
  const birthDateRaw = str(formData, "birthDate");
  const teamId = str(formData, "teamId");
  const startDateRaw = str(formData, "startDate");

  if (!firstName || !lastName) throw new Error("First and last name are required");

  const rider = await prisma.rider.create({
    data: {
      firstName,
      lastName,
      nationality,
      birthDate: birthDateRaw ? new Date(birthDateRaw) : null,
    },
  });

  if (teamId) {
    await prisma.teamStint.create({
      data: {
        riderId: rider.id,
        teamId,
        startDate: startDateRaw ? new Date(startDateRaw) : new Date(),
      },
    });
  }

  revalidatePath("/riders");
  redirect(`/riders/${rider.id}`);
}

export async function setRiderRetired(riderId: string, retired: boolean) {
  await prisma.rider.update({ where: { id: riderId }, data: { retired } });
  revalidatePath(`/riders/${riderId}`);
}

export async function transferRider(formData: FormData) {
  const riderId = str(formData, "riderId");
  const teamId = str(formData, "teamId");
  const startDateRaw = str(formData, "startDate");
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();

  if (!riderId || !teamId) throw new Error("Rider and team are required");

  await prisma.$transaction([
    prisma.teamStint.updateMany({
      where: { riderId, endDate: null },
      data: { endDate: startDate },
    }),
    prisma.teamStint.create({
      data: { riderId, teamId, startDate },
    }),
  ]);

  revalidatePath(`/riders/${riderId}`);
  revalidatePath(`/teams/${teamId}`);
}

export async function endStint(stintId: string) {
  const stint = await prisma.teamStint.update({
    where: { id: stintId },
    data: { endDate: new Date() },
  });
  revalidatePath(`/riders/${stint.riderId}`);
  revalidatePath(`/teams/${stint.teamId}`);
}

// ── Teams ───────────────────────────────────────────────────────────────────

export async function createTeam(formData: FormData) {
  const name = str(formData, "name");
  const country = str(formData, "country") || null;
  const color = str(formData, "color") || null;
  if (!name) throw new Error("Team name is required");

  const team = await prisma.team.create({ data: { name, country, color } });
  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

// ── Categories (custom points scales) ──────────────────────────────────────

export async function createCategory(formData: FormData) {
  const name = str(formData, "name");
  const pointsRaw = str(formData, "points");
  if (!name || !pointsRaw) throw new Error("Name and points scale are required");

  const pointsByRank = pointsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));

  await prisma.category.create({
    data: { name, pointsByRank: JSON.stringify(pointsByRank) },
  });
  revalidatePath("/categories");
}

// ── Races ───────────────────────────────────────────────────────────────────

export async function createRace(formData: FormData) {
  const name = str(formData, "name");
  const dateRaw = str(formData, "date");
  const season = Number(str(formData, "season"));
  const categoryId = str(formData, "categoryId");
  if (!name || !dateRaw || !categoryId || !season) throw new Error("All fields are required");

  const race = await prisma.race.create({
    data: { name, date: new Date(dateRaw), season, categoryId },
  });
  revalidatePath("/races");
  redirect(`/races/${race.id}`);
}

export async function addResult(formData: FormData) {
  const raceId = str(formData, "raceId");
  const riderId = str(formData, "riderId");
  const rank = Number(str(formData, "rank"));
  const teamId = str(formData, "teamId") || null;
  const pointsOverrideRaw = str(formData, "points");

  if (!raceId || !riderId || !rank) throw new Error("Rider and rank are required");

  const race = await prisma.race.findUniqueOrThrow({ where: { id: raceId }, include: { category: true } });
  const scale = parsePointsByRank(race.category.pointsByRank);
  const points = pointsOverrideRaw !== "" ? Number(pointsOverrideRaw) : pointsForRank(scale, rank);

  await prisma.result.create({
    data: { raceId, riderId, teamId, rank, points },
  });

  revalidatePath(`/races/${raceId}`);
  revalidatePath("/rankings");
  revalidatePath(`/riders/${riderId}`);
}

export async function deleteResult(resultId: string) {
  const result = await prisma.result.delete({ where: { id: resultId } });
  revalidatePath(`/races/${result.raceId}`);
  revalidatePath("/rankings");
  revalidatePath(`/riders/${result.riderId}`);
}
