import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getProgressBreakdown,
  getRaidProgress,
  getTierRaids,
  allProgressionTiers,
  progressionExpansions,
  type ProgressionRaid,
  type ProgressionSeed,
} from "../src/lib/progressionTiers";

type WclReport = {
  sourceLabel?: string | null;
  sourceTiers?: string[] | null;
  zone?: { name?: string | null } | null;
  fights?: Array<{ name?: string | null }> | null;
};

type WclReportsData = {
  reports?: WclReport[] | null;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as T;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function summarizeTier(tierSlug: string, raids: ProgressionRaid[]) {
  const tier = allProgressionTiers.find((candidate) => candidate.slug === tierSlug);

  if (!tier) {
    console.log(`${tierSlug}: unknown tier`);
    return;
  }

  const tierRaids = getTierRaids(tier, raids);
  const progress = tierRaids.reduce(
    (sum, raid) => {
      const raidProgress = getRaidProgress(raid);

      return {
        killedBosses: sum.killedBosses + raidProgress.killedBosses,
        totalBosses: sum.totalBosses + raidProgress.totalBosses,
        heroicBosses: sum.heroicBosses + raidProgress.heroicBosses,
        normalBosses: sum.normalBosses + raidProgress.normalBosses,
      };
    },
    { killedBosses: 0, totalBosses: 0, heroicBosses: 0, normalBosses: 0 },
  );
  const breakdown = getProgressBreakdown({ ...progress, unkilledBosses: progress.totalBosses - progress.killedBosses });

  console.log(`${tierSlug}: ${progress.killedBosses} / ${progress.totalBosses} · ${breakdown}`);
  for (const raid of tierRaids) {
    const raidProgress = getRaidProgress(raid);
    console.log(`  - ${raid.name}: ${raidProgress.killedBosses} / ${raidProgress.totalBosses} (${unique(raid.sourceLabels ?? []).join(", ") || "no source"})`);
    console.log(`    ${unique((raid.bosses ?? []).map((boss) => boss.name)).join(", ") || "no bosses"}`);
  }
}

const reportsData = readJson<WclReportsData>("src/data/wclReports.json");
const progressionSeed = readJson<ProgressionSeed>("src/data/wclProgressionSeed.json");
const reports = reportsData.reports ?? [];
const raids = progressionSeed.raids ?? [];

console.log("WCL progression debug");
console.log("");
console.log("Sources loaded");
for (const source of progressionSeed.sources ?? []) {
  console.log(`- ${source.label ?? "Unknown source"}: ${(source.tiers ?? []).join(", ") || "no tiers"}`);
}

console.log("");
console.log("Raids found per tier");
for (const expansion of progressionExpansions) {
  console.log(`${expansion.name}`);
  for (const tier of expansion.tiers) {
    summarizeTier(tier.slug, raids);
  }
}

console.log("");
console.log("Tier 5 source contributions");
for (const label of unique(reports.map((report) => report.sourceLabel))) {
  const tier5Reports = reports.filter((report) => {
    const text = `${report.zone?.name ?? ""} ${(report.fights ?? []).map((fight) => fight.name ?? "").join(" ")}`;

    return /SSC|TK|Serpentshrine|Tempest|The Eye|Vashj|Kael|Void Reaver|Astromancer|Hydross|Lurker/i.test(text) && report.sourceLabel === label;
  });

  if (tier5Reports.length > 0) {
    console.log(`- ${label}: ${tier5Reports.length} matching report(s)`);
  }
}

console.log("");
console.log("MoP Tier 15 checks");
console.log(`- Throne of Thunder reports: ${reports.filter((report) => report.zone?.name === "Throne of Thunder").length}`);
console.log(`- Throne of Thunder progression raids: ${raids.filter((raid) => raid.name === "Throne of Thunder").length}`);
