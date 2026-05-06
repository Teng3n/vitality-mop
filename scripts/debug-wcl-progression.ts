import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allProgressionTiers,
  getProgressBreakdown,
  getRaidProgress,
  getTierRaids,
  progressionExpansions,
  type ProgressionRaid,
  type ProgressionSeed,
} from "../src/lib/progressionTiers";

type WclFight = {
  name?: string | null;
  difficulty?: string | null;
  kill?: boolean | null;
  bossPercentage?: number | null;
  reportUrl?: string | null;
};

type WclReport = {
  code?: string | null;
  title?: string | null;
  sourceLabel?: string | null;
  sourceTiers?: string[] | null;
  zone?: { name?: string | null } | null;
  fights?: WclFight[] | null;
};

type WclReportsData = {
  reports?: WclReport[] | null;
};

type WclGuildProgressRecord = {
  bossName?: string | null;
  raidName?: string | null;
  status?: string | null;
  firstKillDate?: string | null;
  sourceLabel?: string | null;
  progressZoneId?: number | null;
};

type WclGuildProgressData = {
  targets?: Array<{
    guildId?: number | null;
    sourceLabel?: string | null;
    zoneId?: number | null;
    tierSlug?: string | null;
    killedCount?: number | null;
    records?: WclGuildProgressRecord[] | null;
  }> | null;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tier5Sources = ["Might - Fairbanks", "Inept - Grobbulus"];
const tier5ZoneMatchers = [/Tempest Keep/i, /The Eye/i, /TK/i, /SSC \/ TK/i, /Serpentshrine Cavern/i];
const sscBosses = [
  "Hydross the Unstable",
  "The Lurker Below",
  "Leotheras the Blind",
  "Fathom-Lord Karathress",
  "Morogrim Tidewalker",
  "Lady Vashj",
];
const tkBosses = ["Al'ar", "Void Reaver", "High Astromancer Solarian", "Kael'thas Sunstrider"];
const tier5BossSearchTerms = [...sscBosses, ...tkBosses, "Kael'thas"];

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as T;
}

function readJsonIfExists<T>(relativePath: string): T | null {
  const filePath = path.join(root, relativePath);

  return fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, "utf8")) as T) : null;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function countBy(values: string[]) {
  return [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>())].sort(
    ([a], [b]) => a.localeCompare(b),
  );
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

  console.log(`${tierSlug}: ${progress.killedBosses} / ${progress.totalBosses} | ${breakdown}`);
  for (const raid of tierRaids) {
    const raidProgress = getRaidProgress(raid);
    console.log(`  - ${raid.name}: ${raidProgress.killedBosses} / ${raidProgress.totalBosses} (${unique(raid.sourceLabels ?? []).join(", ") || "no source"})`);
    console.log(`    ${unique((raid.bosses ?? []).map((boss) => boss.name)).join(", ") || "no bosses"}`);
  }
}

function reportMatchesTier5(report: WclReport) {
  const reportText = `${report.zone?.name ?? ""} ${report.title ?? ""}`;
  const fightText = (report.fights ?? []).map((fight) => fight.name ?? "").join(" ");

  return tier5ZoneMatchers.some((matcher) => matcher.test(reportText)) ||
    tier5BossSearchTerms.some((bossName) => fightText.includes(bossName));
}

function getBossHits(sourceReports: WclReport[], bossName: string) {
  return sourceReports.flatMap((report) =>
    (report.fights ?? [])
      .filter((fight) => String(fight.name ?? "").includes(bossName))
      .map((fight) => ({
        sourceLabel: report.sourceLabel ?? "Unknown source",
        reportCode: report.code ?? "Unknown report",
        reportTitle: report.title ?? "",
        zoneName: report.zone?.name ?? "Unknown zone",
        fightName: fight.name ?? "Unknown fight",
        difficulty: fight.difficulty ?? "Unknown",
        kill: Boolean(fight.kill),
        bossPercentage: typeof fight.bossPercentage === "number" ? fight.bossPercentage : null,
        reportUrl: fight.reportUrl ?? "",
      })),
  );
}

function printBossCoverage(sourceReports: WclReport[], bossNames: string[]) {
  for (const bossName of bossNames) {
    const hits = getBossHits(sourceReports, bossName);
    const kills = hits.filter((hit) => hit.kill);
    const noKillFights = hits.filter((hit) => !hit.kill);
    const zeroPercentNoKill = noKillFights.filter((hit) => hit.bossPercentage === 0);
    const bestPercent = hits
      .map((hit) => hit.bossPercentage)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b)[0];

    console.log(
      `- ${bossName}: ${hits.length} fight(s), ${kills.length} kill(s), ${noKillFights.length} no-kill, ${
        zeroPercentNoKill.length
      } no-kill at 0%, best percent ${bestPercent ?? "n/a"}`,
    );

    if (kills.length > 0) {
      console.log(`  kill sources: ${unique(kills.map((hit) => hit.sourceLabel)).join(", ")}`);
    }
  }
}

function printTier5Debug(allReports: WclReport[]) {
  console.log("");
  console.log("TBC Tier 5 Debug");
  console.log(`Sources checked: ${tier5Sources.join(", ")}`);

  const sourceReports = allReports.filter((report) => tier5Sources.includes(String(report.sourceLabel ?? "")));
  const tier5Reports = sourceReports.filter(reportMatchesTier5);

  console.log("");
  console.log("Total reports by source");
  for (const source of tier5Sources) {
    console.log(`- ${source}: ${sourceReports.filter((report) => report.sourceLabel === source).length}`);
  }

  console.log("");
  console.log("Tier 5 reports by source");
  for (const source of tier5Sources) {
    console.log(`- ${source}: ${tier5Reports.filter((report) => report.sourceLabel === source).length}`);
  }

  console.log("");
  console.log("Tier 5 zones found by source");
  for (const source of tier5Sources) {
    const zones = countBy(
      tier5Reports
        .filter((report) => report.sourceLabel === source)
        .map((report) => report.zone?.name ?? "Unknown zone"),
    );

    console.log(`- ${source}: ${zones.map(([zone, count]) => `${zone} (${count})`).join(", ") || "none"}`);
  }

  console.log("");
  console.log("SSC boss coverage in synced reports");
  printBossCoverage(sourceReports, sscBosses);

  console.log("");
  console.log("TK boss coverage in synced reports");
  printBossCoverage(sourceReports, tkBosses);

  const kaelHits = getBossHits(sourceReports, "Kael'thas");
  console.log("");
  console.log(`Kael'thas raw synced report presence: ${kaelHits.length > 0 ? "found" : "not found"}`);
  console.log(`Kael'thas kill=true anywhere: ${kaelHits.some((hit) => hit.kill) ? "yes" : "no"}`);
}

function printTier5GuildProgressDebug(guildProgressData: WclGuildProgressData | null) {
  console.log("");
  console.log("TBC Tier 5 guild progress supplement");

  const targets = (guildProgressData?.targets ?? []).filter((target) => target.tierSlug === "tbc-tier-5");

  if (targets.length === 0) {
    console.log("No Tier 5 guild progress supplement data found.");
    return;
  }

  for (const target of targets) {
    const records = target.records ?? [];
    const killedRecords = records.filter((record) => record.status === "Killed");

    console.log(
      `- ${target.sourceLabel ?? "Unknown source"} guild ${target.guildId ?? "unknown"} zone ${
        target.zoneId ?? "unknown"
      }: ${killedRecords.length} killed record(s), WCL killedCount ${target.killedCount ?? "unknown"}`,
    );

    for (const bossName of [...sscBosses, ...tkBosses]) {
      const record = records.find((candidate) => candidate.bossName === bossName);
      console.log(
        `  - ${bossName}: ${record ? record.status ?? "Unknown" : "Missing"}${record?.firstKillDate ? ` at ${record.firstKillDate}` : ""}`,
      );
    }
  }
}

const reportsData = readJson<WclReportsData>("src/data/wclReports.json");
const progressionSeed = readJson<ProgressionSeed>("src/data/wclProgressionSeed.json");
const guildProgressData = readJsonIfExists<WclGuildProgressData>("src/data/wclGuildProgress.json");
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

printTier5Debug(reports);
printTier5GuildProgressDebug(guildProgressData);

console.log("");
console.log("MoP Tier 15 checks");
console.log(`- Throne of Thunder reports: ${reports.filter((report) => report.zone?.name === "Throne of Thunder").length}`);
console.log(`- Throne of Thunder progression raids: ${raids.filter((raid) => raid.name === "Throne of Thunder").length}`);
