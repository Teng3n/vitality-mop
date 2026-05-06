import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { getTierForRaidName } from "../src/lib/progressionTiers";

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
  difficulty?: number | string | null;
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

type WclGuildSource = {
  guildId?: number;
  guildName: string;
  serverSlug: string;
  serverName: string;
  region: string;
  label: string;
  tiers: string[];
};

type WclSourceSummary = {
  guildId?: number;
  guildName: string;
  serverSlug: string;
  region: string;
  label: string;
  tiers: string[];
};

type WclFight = {
  id: number;
  name: string;
  encounterId: number | null;
  difficulty: string;
  difficultyId: number | null;
  rawDifficultyId: number | string | null;
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
  sourceGuildId?: number;
  sourceGuildName: string;
  sourceServerSlug: string;
  sourceRegion: string;
  sourceLabel: string;
  sourceTiers: string[];
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
  difficultyId: number | null;
  rawDifficultyId: number | string | null;
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
  sourceGuildId?: number | null;
  sourceGuildName: string | null;
  sourceServerSlug: string | null;
  sourceRegion: string | null;
  sourceLabel: string | null;
  sourceLabels: string[];
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
  sources: WclSourceSummary[];
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
  sources: WclSourceSummary[];
  reportsSynced: number;
  fightsSynced: number;
};

type WclRankingsData = {
  available: boolean;
  reason: string | null;
  currentRaid: string | null;
  difficulty: string | null;
  sourceLabel: string | null;
  lastUpdated: string | null;
  rankings: {
    world: number | null;
    region: number | null;
    realm: number | null;
    faction: number | null;
  };
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
  sourceGuildId?: number | null;
  sourceGuildName: string | null;
  sourceServerSlug: string | null;
  sourceRegion: string | null;
  sourceLabel: string | null;
  sourceLabels: Set<string>;
  bosses: Map<string, BossDraft>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://classic.warcraftlogs.com/api/v2/client";
const tokenEndpoint = "https://www.warcraftlogs.com/oauth/token";
const sourceName = "Warcraft Logs API v2";
const reportUrlBase = "https://classic.warcraftlogs.com/reports";

loadEnv({ path: path.join(root, ".env.local"), override: false });
loadEnv({ path: path.join(root, ".env"), override: false });

const reportLimit = getReportLimit(process.env.WCL_REPORT_LIMIT);
const reportPages = getReportPages(process.env.WCL_REPORT_PAGES);
const guildSources = getGuildSources();
const primarySource = guildSources[0];

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

const guildReportsByGuildIdQuery = `
query GuildReportsByGuildId($guildId: Int!, $limit: Int!, $page: Int!) {
  reportData {
    reports(
      guildID: $guildId
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

function getReportPages(value: unknown) {
  const parsed = Number(cleanText(value));

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 5;
  }

  return Math.min(Math.floor(parsed), 20);
}

function serverSlugToName(value: string) {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function normalizeSourceTiers(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((tier) => cleanText(tier)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeGuildId(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const parsed = Number(text);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeGuildSource(value: unknown, index: number): WclGuildSource | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const guildName = cleanText(source.guildName ?? source.guild ?? source.name);
  const serverSlug = cleanText(source.serverSlug ?? source.server ?? source.guildServerSlug).toLowerCase();
  const region = (cleanText(source.region ?? source.serverRegion ?? source.guildServerRegion) || "US").toUpperCase();
  const guildId = normalizeGuildId(source.guildId ?? source.guildID ?? source.id);

  if (!guildId && (!guildName || !serverSlug)) {
    console.warn(`Skipping Warcraft Logs source ${index + 1}: missing guildId or guildName/serverSlug.`);
    return null;
  }

  const serverName = cleanText(source.serverName) || (serverSlug ? serverSlugToName(serverSlug) : "");
  const label = cleanText(source.label) || (guildName && serverName ? `${guildName} - ${serverName}` : `Guild ${guildId}`);

  return {
    ...(guildId ? { guildId } : {}),
    guildName,
    serverSlug,
    serverName,
    region,
    label,
    tiers: normalizeSourceTiers(source.tiers),
  };
}

function getFallbackGuildSource(): WclGuildSource {
  const guildName = cleanText(process.env.WCL_GUILD_NAME) || "Vitality";
  const serverSlug = (cleanText(process.env.WCL_SERVER_SLUG) || "raden").toLowerCase();
  const serverName = cleanText(process.env.WCL_SERVER_NAME) || serverSlugToName(serverSlug);
  const region = (cleanText(process.env.WCL_REGION) || "US").toUpperCase();

  return {
    guildName,
    serverSlug,
    serverName,
    region,
    label: cleanText(process.env.WCL_SOURCE_LABEL) || `${guildName} - ${serverName}`,
    tiers: [],
  };
}

function getGuildSources(): WclGuildSource[] {
  const sourcesJson = cleanText(process.env.WCL_GUILD_SOURCES_JSON);

  if (!sourcesJson) {
    return [getFallbackGuildSource()];
  }

  try {
    const parsed = JSON.parse(sourcesJson) as unknown;
    const sources = Array.isArray(parsed)
      ? parsed.map(normalizeGuildSource).filter((source): source is WclGuildSource => Boolean(source))
      : [];

    if (sources.length > 0) {
      return sources;
    }

    console.warn("WCL_GUILD_SOURCES_JSON did not contain any valid sources. Falling back to WCL_GUILD_NAME.");
  } catch (error) {
    console.warn(`Could not parse WCL_GUILD_SOURCES_JSON. Falling back to WCL_GUILD_NAME. ${error instanceof Error ? error.message : ""}`);
  }

  return [getFallbackGuildSource()];
}

function toSourceSummary(source: WclGuildSource): WclSourceSummary {
  return {
    ...(source.guildId ? { guildId: source.guildId } : {}),
    guildName: source.guildName,
    serverSlug: source.serverSlug,
    region: source.region,
    label: source.label,
    tiers: source.tiers,
  };
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

function normalizeDifficulty(value: number | string | null | undefined) {
  const rawDifficultyId = typeof value === "number" || typeof value === "string" ? value : null;
  const text = cleanText(value);
  const numericDifficulty = text ? Number(text) : Number.NaN;
  const difficultyId = Number.isFinite(numericDifficulty) ? numericDifficulty : null;
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (difficultyId !== null) {
    switch (difficultyId) {
      case 3:
        return { difficulty: "Normal", difficultyId, rawDifficultyId };
      case 4:
        return { difficulty: "Heroic", difficultyId, rawDifficultyId };
      case 5:
        return { difficulty: "Mythic", difficultyId, rawDifficultyId };
      case 7:
        return { difficulty: "Looking For Raid", difficultyId, rawDifficultyId };
      default:
        return { difficulty: difficultyId > 0 ? `Difficulty ${difficultyId}` : "Unknown", difficultyId, rawDifficultyId };
    }
  }

  switch (normalizedText) {
    case "normal":
      return { difficulty: "Normal", difficultyId, rawDifficultyId };
    case "heroic":
      return { difficulty: "Heroic", difficultyId, rawDifficultyId };
    case "mythic":
      return { difficulty: "Mythic", difficultyId, rawDifficultyId };
    case "lookingforraid":
    case "lfr":
      return { difficulty: "Looking For Raid", difficultyId, rawDifficultyId };
    default:
      return { difficulty: "Unknown", difficultyId, rawDifficultyId };
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

function normalizeApiReport(report: WclReportApiReport, source: WclGuildSource): WclReport | null {
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

      const difficulty = normalizeDifficulty(fight.difficulty);
      const startMs = getAbsoluteFightTime(reportStartMs, fight.startTime);
      const endMs = getAbsoluteFightTime(reportStartMs, fight.endTime);
      const durationMs = startMs !== null && endMs !== null && endMs >= startMs ? endMs - startMs : null;

      return {
        id,
        name: cleanText(fight.name) || "Unknown Encounter",
        encounterId: toNumber(fight.encounterID),
        difficulty: difficulty.difficulty,
        difficultyId: difficulty.difficultyId,
        rawDifficultyId: difficulty.rawDifficultyId,
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
    ...(source.guildId ? { sourceGuildId: source.guildId } : {}),
    sourceGuildName: source.guildName,
    sourceServerSlug: source.serverSlug,
    sourceRegion: source.region,
    sourceLabel: source.label,
    sourceTiers: source.tiers,
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

async function fetchGuildReports(accessToken: string, source: WclGuildSource): Promise<WclReportsData> {
  if (source.guildId) {
    try {
      return await fetchGuildReportsPages(accessToken, source, guildReportsByGuildIdQuery, {
        guildId: source.guildId,
        limit: reportLimit,
      });
    } catch (error) {
      if (!source.guildName || !source.serverSlug) {
        throw error;
      }

      console.warn(
        `Warcraft Logs guildId lookup failed for ${source.label}; falling back to guildName/serverSlug. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!source.guildName || !source.serverSlug) {
    throw new Error(`Warcraft Logs source ${source.label} needs guildName and serverSlug when guildId lookup is unavailable.`);
  }

  return fetchGuildReportsPages(accessToken, source, guildReportsQuery, {
    guildName: source.guildName,
    serverSlug: source.serverSlug,
    serverRegion: source.region,
    limit: reportLimit,
  });
}

async function fetchGuildReportsPages(
  accessToken: string,
  source: WclGuildSource,
  query: string,
  baseVariables: Record<string, unknown>,
): Promise<WclReportsData> {
  const reports: WclReportApiReport[] = [];

  for (let page = 1; page <= reportPages; page += 1) {
    const data = await requestGraphQl<WclReportsQueryData>(accessToken, query, {
      ...baseVariables,
      page,
    });
    const pageData = data.reportData?.reports;
    const pageReports = pageData?.data ?? [];

    if (pageReports.length === 0) {
      break;
    }

    reports.push(...pageReports);

    const lastPage = toNumber(pageData?.last_page);
    const currentPage = toNumber(pageData?.current_page) ?? page;

    if (lastPage !== null && currentPage >= lastPage) {
      break;
    }
  }

  return {
    reports: reports
      .map((report) => normalizeApiReport(report, source))
      .filter((report): report is WclReport => Boolean(report))
      .sort(
        (a, b) =>
          compareNullableIsoDates(b.startTime, a.startTime) ||
          a.sourceLabel.localeCompare(b.sourceLabel) ||
          a.code.localeCompare(b.code),
      ),
  };
}

async function readJsonIfExists<T>(relativePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(path.join(root, relativePath), "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function getReportSourceLabel(report: Partial<WclReport>, fallbackSource = primarySource) {
  return cleanText(report.sourceLabel) || fallbackSource.label;
}

function normalizeExistingReportSource(report: WclReport, fallbackSource = primarySource): WclReport {
  const sourceLabel = getReportSourceLabel(report, fallbackSource);
  const sourceGuildId = normalizeGuildId(report.sourceGuildId ?? fallbackSource.guildId);

  return {
    ...report,
    ...(sourceGuildId ? { sourceGuildId } : {}),
    sourceGuildName: cleanText(report.sourceGuildName) || fallbackSource.guildName,
    sourceServerSlug: cleanText(report.sourceServerSlug) || fallbackSource.serverSlug,
    sourceRegion: cleanText(report.sourceRegion) || fallbackSource.region,
    sourceLabel,
    sourceTiers: Array.isArray(report.sourceTiers) ? report.sourceTiers : fallbackSource.tiers,
  };
}

function sortReports(reports: WclReport[]) {
  return [...reports].sort(
    (a, b) =>
      compareNullableIsoDates(b.startTime, a.startTime) ||
      getReportSourceLabel(a).localeCompare(getReportSourceLabel(b)) ||
      a.code.localeCompare(b.code),
  );
}

function combineSourceReports(reportsBySource: Map<string, WclReport[]>) {
  return {
    reports: sortReports([...reportsBySource.values()].flat()),
  };
}

function getConfiguredSourceByLabel(label: string) {
  return guildSources.find((source) => source.label === label);
}

function sourceMatchesTier(source: WclGuildSource | undefined, tierSlug?: string) {
  return !tierSlug || !source?.tiers.length || source.tiers.includes(tierSlug);
}

function chooseReportsForRaid(reports: WclReport[]) {
  const tierSlug = getTierForRaidName(reports[0]?.zone.name)?.slug;
  const preferred = reports.filter((report) => sourceMatchesTier(getConfiguredSourceByLabel(getReportSourceLabel(report)), tierSlug));
  const candidates = preferred.length > 0 ? preferred : reports;
  const grouped = new Map<string, WclReport[]>();

  for (const report of candidates) {
    const label = getReportSourceLabel(report);
    grouped.set(label, [...(grouped.get(label) ?? []), report]);
  }

  return [...grouped.values()].sort((a, b) => {
    const newestA = a.map((report) => report.startTime ?? "").sort().at(-1) ?? "";
    const newestB = b.map((report) => report.startTime ?? "").sort().at(-1) ?? "";

    return newestB.localeCompare(newestA) || getReportSourceLabel(a[0]).localeCompare(getReportSourceLabel(b[0]));
  })[0] ?? [];
}

function createDifficultyDraft(): DifficultyDraft {
  return {
    status: "Best Pull",
    difficultyId: null,
    rawDifficultyId: null,
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
  if (difficulty.difficultyId === null && fight.difficultyId !== null) {
    difficulty.difficultyId = fight.difficultyId;
  }

  if (difficulty.rawDifficultyId === null && fight.rawDifficultyId !== null) {
    difficulty.rawDifficultyId = fight.rawDifficultyId;
  }

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
  const reportsByRaid = new Map<string, WclReport[]>();

  for (const report of reportsData.reports) {
    const raidKey = `${report.zone.id ?? "unknown"}:${report.zone.name}`;
    reportsByRaid.set(raidKey, [...(reportsByRaid.get(raidKey) ?? []), report]);
  }

  for (const reports of [...reportsByRaid.values()].map(chooseReportsForRaid)) {
    const firstReport = reports[0];

    if (!firstReport) {
      continue;
    }

    const raidKey = `${firstReport.zone.id ?? "unknown"}:${firstReport.zone.name}`;
    const raid =
      raidDrafts.get(raidKey) ??
      ({
        name: firstReport.zone.name,
        zoneId: firstReport.zone.id,
        sourceGuildId: firstReport.sourceGuildId,
        sourceGuildName: firstReport.sourceGuildName,
        sourceServerSlug: firstReport.sourceServerSlug,
        sourceRegion: firstReport.sourceRegion,
        sourceLabel: firstReport.sourceLabel,
        sourceLabels: new Set<string>(),
        bosses: new Map<string, BossDraft>(),
      } satisfies RaidDraft);
    raidDrafts.set(raidKey, raid);

    for (const report of reports) {
      raid.sourceLabels.add(getReportSourceLabel(report));

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
                  difficultyId: difficulty.difficultyId,
                  rawDifficultyId: difficulty.rawDifficultyId,
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
        ...(raid.sourceGuildId ? { sourceGuildId: raid.sourceGuildId } : {}),
        sourceGuildName: raid.sourceGuildName,
        sourceServerSlug: raid.sourceServerSlug,
        sourceRegion: raid.sourceRegion,
        sourceLabel: raid.sourceLabel,
        sourceLabels: [...raid.sourceLabels].sort((a, b) => a.localeCompare(b)),
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
      name: primarySource.guildName,
      server: primarySource.serverName,
      serverSlug: primarySource.serverSlug,
      region: primarySource.region,
    },
    sources: guildSources.map(toSourceSummary),
    raids,
  };
}

function buildSyncMeta(reportsData: WclReportsData): WclSyncMeta {
  return {
    lastWclSync: new Date().toISOString(),
    source: sourceName,
    endpoint,
    guild: primarySource.guildName,
    server: primarySource.serverName,
    serverSlug: primarySource.serverSlug,
    region: primarySource.region,
    sources: guildSources.map(toSourceSummary),
    reportsSynced: reportsData.reports.length,
    fightsSynced: reportsData.reports.reduce((sum, report) => sum + report.fights.length, 0),
  };
}

function getLatestProgressionKill(progressionSeed: WclProgressionSeed) {
  const kills: Array<{
    raidName: string;
    difficultyName: string;
    date: string;
    sourceLabel: string | null;
  }> = [];

  for (const raid of progressionSeed.raids) {
    for (const boss of raid.bosses) {
      for (const [difficultyName, difficulty] of Object.entries(boss.difficulties)) {
        if (difficulty.status === "Killed") {
          const date = difficulty.latestKillDate || difficulty.firstKillDate;

          if (date) {
            kills.push({ raidName: raid.name, difficultyName, date, sourceLabel: raid.sourceLabel });
          }
        }
      }
    }
  }

  return kills.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function buildRankingsFallback(progressionSeed: WclProgressionSeed): WclRankingsData {
  const latestKill = getLatestProgressionKill(progressionSeed);

  return {
    available: false,
    reason: "Warcraft Logs API did not expose guild zone rankings in the queried schema.",
    currentRaid: latestKill?.raidName ?? progressionSeed.raids[0]?.name ?? null,
    difficulty: latestKill?.difficultyName ?? null,
    sourceLabel: latestKill?.sourceLabel ?? progressionSeed.raids[0]?.sourceLabel ?? null,
    lastUpdated: null,
    rankings: {
      world: null,
      region: null,
      realm: null,
      faction: null,
    },
  };
}

async function runWarcraftLogsSync() {
  const accessToken = await requestAccessToken();

  if (!accessToken) {
    return;
  }

  const existingReportsData = await readJsonIfExists<WclReportsData>("src/data/wclReports.json");
  const existingReports = (existingReportsData?.reports ?? []).map((report) => normalizeExistingReportSource(report));
  const existingReportsBySource = new Map<string, WclReport[]>();
  const reportsBySource = new Map<string, WclReport[]>();
  const failedSources: WclGuildSource[] = [];

  for (const report of existingReports) {
    const label = getReportSourceLabel(report);
    existingReportsBySource.set(label, [...(existingReportsBySource.get(label) ?? []), report]);
  }

  for (const source of guildSources) {
    console.log(`Syncing Warcraft Logs source: ${source.label} (${source.guildName} - ${source.serverSlug}, ${source.region})`);

    try {
      const sourceReports = await fetchGuildReports(accessToken, source);
      reportsBySource.set(source.label, sourceReports.reports);
    } catch (error) {
      failedSources.push(source);
      console.error(`Warcraft Logs source failed for ${source.label}: ${error instanceof Error ? error.message : String(error)}`);

      const preservedReports = existingReportsBySource.get(source.label);

      if (preservedReports?.length) {
        reportsBySource.set(source.label, preservedReports);
        console.error(`Preserving ${preservedReports.length} existing reports for ${source.label}.`);
      }
    }
  }

  if (reportsBySource.size === 0) {
    console.error("No Warcraft Logs sources synced successfully. Preserving existing Warcraft Logs JSON files.");
    return;
  }

  const reportsData = combineSourceReports(reportsBySource);
  if (reportsData.reports.length === 0 && existingReports.length > 0) {
    console.error("Warcraft Logs sources returned no reports. Preserving existing Warcraft Logs JSON files.");
    return;
  }

  const progressionSeed = buildProgressionSeed(reportsData);
  const rankingsData = buildRankingsFallback(progressionSeed);
  const sourceFiles = [
    { path: "src/data/wclReports.json", data: reportsData },
    { path: "src/data/wclProgressionSeed.json", data: progressionSeed },
    { path: "src/data/wclRankings.json", data: rankingsData },
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
  console.log(`Sources: ${guildSources.map((source) => source.label).join(", ")}`);
  if (failedSources.length > 0) {
    console.log(`Failed sources preserved when possible: ${failedSources.map((source) => source.label).join(", ")}`);
  }
  console.log(`Report limit: ${reportLimit}`);
  console.log(`Report pages: ${reportPages}`);
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
