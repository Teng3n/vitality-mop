import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

type GraphQlError = {
  message?: string;
};

type GraphQlResponse<T> = {
  data?: T;
  errors?: GraphQlError[];
};

type WclReportApiFight = {
  id?: number | null;
  name?: string | null;
  encounterID?: number | null;
  difficulty?: number | null;
  kill?: boolean | null;
  bossPercentage?: number | null;
  fightPercentage?: number | null;
  startTime?: number | null;
  endTime?: number | null;
};

type WclReportApiReport = {
  code?: string | null;
  title?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  zone?: {
    id?: number | null;
    name?: string | null;
  } | null;
  fights?: WclReportApiFight[] | null;
};

type WclReportsQueryData = {
  reportData?: {
    reports?: {
      data?: WclReportApiReport[] | null;
      total?: number | null;
      per_page?: number | null;
      current_page?: number | null;
      last_page?: number | null;
    } | null;
  } | null;
};

type WclFight = {
  id: number;
  name: string;
  encounterId: number | null;
  difficulty: string;
  difficultyId: number | null;
  kill: boolean;
  bossPercentage: number | null;
  startTime: string | null;
  endTime: string | null;
  durationMs: number | null;
  reportCode: string;
  reportUrl: string;
};

type WclReport = {
  code: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  url: string;
  zone: {
    id: number | null;
    name: string;
  };
  fights: WclFight[];
};

type WclReportsData = {
  reports: WclReport[];
};

type ProgressionDifficulty = {
  status: "Killed" | "Best Pull";
  firstKillDate: string | null;
  latestKillDate: string | null;
  bestPercent: number | null;
  reportCode: string | null;
  reportUrl: string | null;
  pulls: number;
  kills: number;
};

type ProgressionBoss = {
  name: string;
  encounterId: number | null;
  difficulties: Record<string, ProgressionDifficulty>;
};

type ProgressionRaid = {
  name: string;
  zoneId: number | null;
  bosses: ProgressionBoss[];
  summary: {
    normalKilled: number;
    normalTotal: number;
    heroicKilled: number;
    heroicTotal: number;
  };
};

type WclProgressionSeed = {
  guild: {
    name: string;
    server: string;
    serverSlug: string;
    region: string;
  };
  raids: ProgressionRaid[];
};

type WclSyncMeta = {
  lastWclSync: string | null;
  source: string;
  endpoint: string;
  guild: string;
  server: string;
  serverSlug: string;
  region: string;
  reportsSynced: number;
  fightsSynced: number;
};

type DifficultyDraft = ProgressionDifficulty & {
  firstKillSortTime: number | null;
  latestKillSortTime: number | null;
};

type BossDraft = {
  name: string;
  encounterId: number | null;
  difficulties: Map<string, DifficultyDraft>;
};

type RaidDraft = {
  name: string;
  zoneId: number | null;
  bosses: Map<string, BossDraft>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://classic.warcraftlogs.com/api/v2/client";
const tokenEndpoint = "https://www.warcraftlogs.com/oauth/token";
const sourceName = "Warcraft Logs API v2";
const reportUrlBase = "https://classic.warcraftlogs.com/reports";

loadEnv({ path: path.join(root, ".env.local"), override: false });
loadEnv({ path: path.join(root, ".env"), override: false });

const guildName = cleanText(process.env.WCL_GUILD_NAME) || "Vitality";
const serverSlug = (cleanText(process.env.WCL_SERVER_SLUG) || "raden").toLowerCase();
const serverName = cleanText(process.env.WCL_SERVER_NAME) || serverSlugToName(serverSlug);
const region = (cleanText(process.env.WCL_REGION) || "US").toUpperCase();
const reportLimit = getReportLimit(process.env.WCL_REPORT_LIMIT);

// Focused report/fight query only. It intentionally avoids events, tables, casts, rankings, and player parse data.
const guildReportsQuery = `
query GuildReports($guildName: String!, $serverSlug: String!, $serverRegion: String!, $limit: Int!, $page: Int!) {
  reportData {
    reports(
      guildName: $guildName
      guildServerSlug: $serverSlug
      guildServerRegion: $serverRegion
      limit: $limit
      page: $page
    ) {
      data {
        code
        title
        startTime
        endTime
        zone {
          id
          name
        }
        fights(translate: true) {
          id
          name
          encounterID
          difficulty
          kill
          bossPercentage
          fightPercentage
          startTime
          endTime
        }
      }
      total
      per_page
      current_page
      last_page
    }
  }
}
`;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getReportLimit(value: unknown) {
  const parsed = Number(cleanText(value));

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(Math.floor(parsed), 100);
}

function serverSlugToName(value: string) {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function formatJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readTextIfExists(relativePath: string) {
  try {
    return await fs.readFile(path.join(root, relativePath), "utf8");
  } catch {
    return "";
  }
}

async function jsonWouldChange(relativePath: string, value: unknown) {
  const previous = await readTextIfExists(relativePath);
  return previous !== formatJson(value);
}

async function writeJson(relativePath: string, value: unknown) {
  await fs.writeFile(path.join(root, relativePath), formatJson(value), "utf8");
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePercentage(value: unknown) {
  const parsed = toNumber(value);

  if (parsed === null) {
    return null;
  }

  const percent = parsed > 100 ? parsed / 100 : parsed;
  return Math.round(percent * 100) / 100;
}

function toIsoString(value: unknown) {
  const parsed = toNumber(value);

  if (parsed === null || parsed <= 0) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function getAbsoluteFightTime(reportStartMs: number | null, fightTime: unknown) {
  const parsed = toNumber(fightTime);

  if (parsed === null) {
    return null;
  }

  if (parsed > 1_000_000_000_000) {
    return parsed;
  }

  return reportStartMs === null ? parsed : reportStartMs + parsed;
}

function getDifficultyLabel(value: number | null) {
  switch (value) {
    case 3:
    case 4:
      return "Normal";
    case 5:
    case 6:
      return "Heroic";
    case 7:
      return "Looking For Raid";
    default:
      return value === null ? "Unknown" : `Difficulty ${value}`;
  }
}

function compareNullableIsoDates(a: string | null, b: string | null) {
  if (a && b) {
    return a.localeCompare(b);
  }

  if (a) {
    return -1;
  }

  if (b) {
    return 1;
  }

  return 0;
}

function normalizeApiReport(report: WclReportApiReport): WclReport | null {
  const code = cleanText(report.code);

  if (!code) {
    return null;
  }

  const reportStartMs = toNumber(report.startTime);
  const reportUrl = `${reportUrlBase}/${code}`;
  const fights = (report.fights ?? [])
    .map((fight): WclFight | null => {
      const id = toNumber(fight.id);

      if (id === null) {
        return null;
      }

      const difficultyId = toNumber(fight.difficulty);
      const startMs = getAbsoluteFightTime(reportStartMs, fight.startTime);
      const endMs = getAbsoluteFightTime(reportStartMs, fight.endTime);
      const durationMs = startMs !== null && endMs !== null && endMs >= startMs ? endMs - startMs : null;

      return {
        id,
        name: cleanText(fight.name) || "Unknown Encounter",
        encounterId: toNumber(fight.encounterID),
        difficulty: getDifficultyLabel(difficultyId),
        difficultyId,
        kill: Boolean(fight.kill),
        bossPercentage: normalizePercentage(fight.bossPercentage ?? fight.fightPercentage),
        startTime: toIsoString(startMs),
        endTime: toIsoString(endMs),
        durationMs,
        reportCode: code,
        reportUrl: `${reportUrl}#fight=${id}`,
      };
    })
    .filter((fight): fight is WclFight => Boolean(fight))
    .sort((a, b) => compareNullableIsoDates(a.startTime, b.startTime) || a.id - b.id);

  return {
    code,
    title: cleanText(report.title) || code,
    startTime: toIsoString(report.startTime),
    endTime: toIsoString(report.endTime),
    url: reportUrl,
    zone: {
      id: toNumber(report.zone?.id),
      name: cleanText(report.zone?.name) || "Unknown Zone",
    },
    fights,
  };
}

async function requestAccessToken() {
  const clientId = cleanText(process.env.WCL_CLIENT_ID);
  const clientSecret = cleanText(process.env.WCL_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    console.log("Skipping Warcraft Logs sync: missing credentials.");
    return null;
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Warcraft Logs OAuth failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const parsed = JSON.parse(body) as { access_token?: string };
  const accessToken = cleanText(parsed.access_token);

  if (!accessToken) {
    throw new Error("Warcraft Logs OAuth response did not include an access token.");
  }

  return accessToken;
}

async function requestGraphQl<T>(accessToken: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Warcraft Logs GraphQL failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const parsed = JSON.parse(body) as GraphQlResponse<T>;

  if (parsed.errors?.length) {
    throw new Error(`Warcraft Logs GraphQL errors: ${parsed.errors.map((error) => error.message ?? "Unknown error").join("; ")}`);
  }

  if (!parsed.data) {
    throw new Error("Warcraft Logs GraphQL response did not include data.");
  }

  return parsed.data;
}

async function fetchGuildReports(accessToken: string): Promise<WclReportsData> {
  const data = await requestGraphQl<WclReportsQueryData>(accessToken, guildReportsQuery, {
    guildName,
    serverSlug,
    serverRegion: region,
    limit: reportLimit,
    page: 1,
  });
  const reports = data.reportData?.reports?.data ?? [];

  return {
    reports: reports
      .map(normalizeApiReport)
      .filter((report): report is WclReport => Boolean(report))
      .sort((a, b) => compareNullableIsoDates(b.startTime, a.startTime) || a.code.localeCompare(b.code)),
  };
}

function createDifficultyDraft(): DifficultyDraft {
  return {
    status: "Best Pull",
    firstKillDate: null,
    latestKillDate: null,
    bestPercent: null,
    reportCode: null,
    reportUrl: null,
    pulls: 0,
    kills: 0,
    firstKillSortTime: null,
    latestKillSortTime: null,
  };
}

function getDateSortTime(value: string | null) {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function updateProgressionDifficulty(difficulty: DifficultyDraft, fight: WclFight) {
  difficulty.pulls += 1;

  if (fight.kill) {
    const killSortTime = getDateSortTime(fight.endTime);
    difficulty.status = "Killed";
    difficulty.kills += 1;
    difficulty.bestPercent = 0;

    if (killSortTime !== null && (difficulty.firstKillSortTime === null || killSortTime < difficulty.firstKillSortTime)) {
      difficulty.firstKillSortTime = killSortTime;
      difficulty.firstKillDate = fight.endTime;
      difficulty.reportCode = fight.reportCode;
      difficulty.reportUrl = fight.reportUrl;
    }

    if (killSortTime !== null && (difficulty.latestKillSortTime === null || killSortTime > difficulty.latestKillSortTime)) {
      difficulty.latestKillSortTime = killSortTime;
      difficulty.latestKillDate = fight.endTime;
    }

    return;
  }

  if (difficulty.status === "Killed" || fight.bossPercentage === null) {
    return;
  }

  if (difficulty.bestPercent === null || fight.bossPercentage < difficulty.bestPercent) {
    difficulty.bestPercent = fight.bossPercentage;
    difficulty.reportCode = fight.reportCode;
    difficulty.reportUrl = fight.reportUrl;
  }
}

function buildProgressionSeed(reportsData: WclReportsData): WclProgressionSeed {
  const raidDrafts = new Map<string, RaidDraft>();

  for (const report of reportsData.reports) {
    const raidKey = `${report.zone.id ?? "unknown"}:${report.zone.name}`;
    const raid =
      raidDrafts.get(raidKey) ??
      ({
        name: report.zone.name,
        zoneId: report.zone.id,
        bosses: new Map<string, BossDraft>(),
      } satisfies RaidDraft);
    raidDrafts.set(raidKey, raid);

    for (const fight of report.fights) {
      if (!fight.encounterId) {
        continue;
      }

      const bossKey = `${fight.encounterId}:${fight.name}`;
      const boss =
        raid.bosses.get(bossKey) ??
        ({
          name: fight.name,
          encounterId: fight.encounterId,
          difficulties: new Map<string, DifficultyDraft>(),
        } satisfies BossDraft);
      raid.bosses.set(bossKey, boss);

      const difficulty = boss.difficulties.get(fight.difficulty) ?? createDifficultyDraft();
      boss.difficulties.set(fight.difficulty, difficulty);
      updateProgressionDifficulty(difficulty, fight);
    }
  }

  const raids = [...raidDrafts.values()]
    .map((raid): ProgressionRaid => {
      const bosses = [...raid.bosses.values()]
        .map((boss): ProgressionBoss => ({
          name: boss.name,
          encounterId: boss.encounterId,
          difficulties: Object.fromEntries(
            [...boss.difficulties.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([difficultyName, difficulty]) => [
                difficultyName,
                {
                  status: difficulty.status,
                  firstKillDate: difficulty.firstKillDate,
                  latestKillDate: difficulty.latestKillDate,
                  bestPercent: difficulty.bestPercent,
                  reportCode: difficulty.reportCode,
                  reportUrl: difficulty.reportUrl,
                  pulls: difficulty.pulls,
                  kills: difficulty.kills,
                },
              ]),
          ),
        }))
        .sort((a, b) => (a.encounterId ?? 0) - (b.encounterId ?? 0) || a.name.localeCompare(b.name));
      const normalKilled = bosses.filter((boss) => boss.difficulties.Normal?.status === "Killed").length;
      const heroicKilled = bosses.filter((boss) => boss.difficulties.Heroic?.status === "Killed").length;

      return {
        name: raid.name,
        zoneId: raid.zoneId,
        bosses,
        summary: {
          normalKilled,
          normalTotal: bosses.length,
          heroicKilled,
          heroicTotal: bosses.length,
        },
      };
    })
    .sort((a, b) => (a.zoneId ?? 0) - (b.zoneId ?? 0) || a.name.localeCompare(b.name));

  return {
    guild: {
      name: guildName,
      server: serverName,
      serverSlug,
      region,
    },
    raids,
  };
}

function buildSyncMeta(reportsData: WclReportsData): WclSyncMeta {
  return {
    lastWclSync: new Date().toISOString(),
    source: sourceName,
    endpoint,
    guild: guildName,
    server: serverName,
    serverSlug,
    region,
    reportsSynced: reportsData.reports.length,
    fightsSynced: reportsData.reports.reduce((sum, report) => sum + report.fights.length, 0),
  };
}

async function runWarcraftLogsSync() {
  const accessToken = await requestAccessToken();

  if (!accessToken) {
    return;
  }

  const reportsData = await fetchGuildReports(accessToken);
  const progressionSeed = buildProgressionSeed(reportsData);
  const sourceFiles = [
    { path: "src/data/wclReports.json", data: reportsData },
    { path: "src/data/wclProgressionSeed.json", data: progressionSeed },
  ];
  const changedSourceFiles: string[] = [];
  const changedFiles: string[] = [];

  for (const file of sourceFiles) {
    if (await jsonWouldChange(file.path, file.data)) {
      changedSourceFiles.push(file.path);
    }
  }

  for (const file of sourceFiles) {
    if (changedSourceFiles.includes(file.path)) {
      await writeJson(file.path, file.data);
      changedFiles.push(file.path);
    }
  }

  if (changedSourceFiles.length > 0) {
    const syncMeta = buildSyncMeta(reportsData);

    if (await jsonWouldChange("src/data/wclSyncMeta.json", syncMeta)) {
      await writeJson("src/data/wclSyncMeta.json", syncMeta);
      changedFiles.push("src/data/wclSyncMeta.json");
    }
  }

  console.log("");
  console.log("Warcraft Logs sync complete");
  console.log(`Guild: ${guildName} - ${serverName} (${region})`);
  console.log(`Report limit: ${reportLimit}`);
  console.log(`Reports synced: ${reportsData.reports.length}`);
  console.log(`Fights synced: ${reportsData.reports.reduce((sum, report) => sum + report.fights.length, 0)}`);
  console.log(`Files changed: ${changedFiles.length}`);

  if (changedFiles.length > 0) {
    console.log(`Changed files: ${changedFiles.join(", ")}`);
  }
}

await runWarcraftLogsSync().catch((error: unknown) => {
  console.error(`Warcraft Logs sync failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error("Preserving existing Warcraft Logs JSON files.");
});

