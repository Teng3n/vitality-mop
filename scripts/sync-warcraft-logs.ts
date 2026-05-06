import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { getTierForRaidName, normalizeProgressionName } from "../src/lib/progressionTiers";

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
  expansions: string[];
  tiers: string[];
};

type WclSourceSummary = {
  guildId?: number;
  guildName: string;
  serverSlug: string;
  region: string;
  label: string;
  expansions: string[];
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
  expansionSlug: string;
  tierSlug: string;
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
  guildProgressRecordsSynced: number;
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

type WclGuildProgressQueryData = {
  progressRaceData?: {
    progressRace?: unknown;
  } | null;
};

type WclGuildProgressTarget = {
  guildId: number;
  guildName: string;
  serverSlug: string;
  region: string;
  sourceLabel: string;
  zoneId: number;
  zoneName: string;
  expansionSlug: string;
  tierSlug: string;
  difficulty: string;
  difficultyId: number;
  size: number;
};

type WclGuildProgressRecord = {
  bossName: string;
  encounterId: number | null;
  raidName: string;
  expansionSlug: string;
  tierSlug: string;
  difficulty: string;
  difficultyId: number;
  rawDifficultyId: number;
  status: "Killed" | "Best Pull";
  firstKillDate: string | null;
  latestKillDate: string | null;
  bestPercent: number | null;
  pulls: number;
  kills: number;
  reportCode: string | null;
  reportUrl: string | null;
  sourceGuildId: number;
  sourceGuildName: string;
  sourceServerSlug: string;
  sourceRegion: string;
  sourceLabel: string;
  progressZoneId: number;
  progressZoneName: string;
};

type WclGuildProgressTargetResult = WclGuildProgressTarget & {
  available: boolean;
  reason: string | null;
  killedCount: number | null;
  records: WclGuildProgressRecord[];
};

type WclGuildProgressData = {
  targets: WclGuildProgressTargetResult[];
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
  expansionSlug: string;
  tierSlug: string;
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
const defaultSourceExpansions = ["mop"];
const defaultSourceTiers = ["tier-14", "tier-15", "tier-16"];
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

// WCL guild progress pages use progressRaceData.progressRace. This is a compact boss-progress query, not an event/cast query.
const guildProgressRaceQuery = `
query GuildProgressRace($guildId: Int!, $zoneId: Int!, $difficulty: Int!, $size: Int!) {
  progressRaceData {
    progressRace(guildID: $guildId, zoneID: $zoneId, difficulty: $difficulty, size: $size)
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
    return 25;
  }

  return Math.min(Math.floor(parsed), 50);
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

function normalizeSourceExpansions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((expansion) => cleanText(expansion)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
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
    expansions: normalizeSourceExpansions(source.expansions),
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
    expansions: defaultSourceExpansions,
    tiers: defaultSourceTiers,
  };
}

function getAuditedDefaultGuildSources(): WclGuildSource[] {
  return [
    {
      guildName: "Vitality",
      serverSlug: "raden",
      serverName: "Raden",
      region: "US",
      label: "Vitality - Raden",
      expansions: ["mop"],
      tiers: ["tier-14", "tier-15", "tier-16"],
    },
    {
      guildId: 482914,
      guildName: "Might",
      serverSlug: "fairbanks",
      serverName: "Fairbanks",
      region: "US",
      label: "Might - Fairbanks",
      expansions: ["classic", "tbc"],
      tiers: ["classic-aq", "classic-bwl", "classic-mc-ony", "classic-naxx", "tbc-tier-4", "tbc-tier-5"],
    },
    {
      guildId: 619658,
      guildName: "Inept",
      serverSlug: "grobbulus",
      serverName: "Grobbulus",
      region: "US",
      label: "Inept - Grobbulus",
      expansions: ["tbc", "wrath"],
      tiers: ["tbc-sunwell", "tbc-tier-5", "tbc-tier-6", "wrath-tier-10", "wrath-tier-7", "wrath-tier-8", "wrath-tier-9"],
    },
    {
      guildId: 738773,
      guildName: "Inept",
      serverSlug: "benediction",
      serverName: "Benediction",
      region: "US",
      label: "Inept - Benediction",
      expansions: ["cata"],
      tiers: ["cata-tier-11", "cata-tier-12", "cata-tier-13"],
    },
  ];
}

function hasExplicitSingleGuildSourceConfig() {
  return Boolean(cleanText(process.env.WCL_GUILD_NAME) || cleanText(process.env.WCL_SERVER_SLUG) || cleanText(process.env.WCL_REGION));
}

function getGuildSources(): WclGuildSource[] {
  const sourcesJson = cleanText(process.env.WCL_GUILD_SOURCES_JSON);

  if (!sourcesJson) {
    return hasExplicitSingleGuildSourceConfig() ? [getFallbackGuildSource()] : getAuditedDefaultGuildSources();
  }

  try {
    const parsed = JSON.parse(sourcesJson) as unknown;
    const sources = Array.isArray(parsed)
      ? parsed.map(normalizeGuildSource).filter((source): source is WclGuildSource => Boolean(source))
      : [];

    if (sources.length > 0) {
      return sources;
    }

    console.warn("WCL_GUILD_SOURCES_JSON did not contain any valid sources. Using audited default WCL sources.");
  } catch (error) {
    console.warn(`Could not parse WCL_GUILD_SOURCES_JSON. Using audited default WCL sources. ${error instanceof Error ? error.message : ""}`);
  }

  return getAuditedDefaultGuildSources();
}

function toSourceSummary(source: WclGuildSource): WclSourceSummary {
  return {
    ...(source.guildId ? { guildId: source.guildId } : {}),
    guildName: source.guildName,
    serverSlug: source.serverSlug,
    region: source.region,
    label: source.label,
    expansions: source.expansions,
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
      case 1:
      case 2:
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
  let pagesFetched = 0;

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

    pagesFetched = page;
    reports.push(...pageReports);

    const lastPage = toNumber(pageData?.last_page);
    const currentPage = toNumber(pageData?.current_page) ?? page;

    if (lastPage !== null && currentPage >= lastPage) {
      break;
    }
  }

  console.log(`Fetched ${reports.length} reports from ${source.label} across ${pagesFetched} page(s).`);

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

function getGuildProgressTargets(): WclGuildProgressTarget[] {
  const tier5Source = guildSources.find((source) => source.guildId === 619658 && source.tiers.includes("tbc-tier-5"));

  if (!tier5Source?.guildId) {
    return [];
  }

  return [
    {
      guildId: tier5Source.guildId,
      guildName: tier5Source.guildName,
      serverSlug: tier5Source.serverSlug,
      region: tier5Source.region,
      sourceLabel: tier5Source.label,
      // WCL Classic guild progress zone 1010 is the TBC Tier 5 SSC/TK progress page.
      zoneId: 1010,
      zoneName: "TBC Tier 5",
      expansionSlug: "tbc",
      tierSlug: "tbc-tier-5",
      difficulty: "Normal",
      difficultyId: 3,
      size: 25,
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectProgressObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (!value || typeof value !== "object") {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectProgressObjects(item, output);
    }

    return output;
  }

  const objectValue = value as Record<string, unknown>;
  output.push(objectValue);

  for (const item of Object.values(objectValue)) {
    collectProgressObjects(item, output);
  }

  return output;
}

function findProgressGuildPayload(payload: unknown, target: WclGuildProgressTarget) {
  const candidates = collectProgressObjects(payload).filter((objectValue) => Array.isArray(objectValue.encounters));

  return (
    candidates.find((candidate) => toNumber(candidate.id) === target.guildId) ??
    candidates.find((candidate) => cleanText(candidate.name).toLowerCase() === target.guildName.toLowerCase()) ??
    candidates[0] ??
    null
  );
}

function getProgressEncounterName(encounter: Record<string, unknown>) {
  return cleanText(encounter.name ?? encounter.encounterName ?? encounter.shortName);
}

function getProgressReportCode(encounter: Record<string, unknown>) {
  const nestedReport = isRecord(encounter.report) ? encounter.report : null;
  const code = cleanText(encounter.reportCode ?? encounter.reportID ?? nestedReport?.code);

  return code || null;
}

function getProgressReportUrl(encounter: Record<string, unknown>, reportCode: string | null) {
  const nestedReport = isRecord(encounter.report) ? encounter.report : null;
  const url = cleanText(encounter.reportUrl ?? encounter.reportURL ?? nestedReport?.url);

  if (url) {
    return url;
  }

  return reportCode ? `${reportUrlBase}/${reportCode}` : null;
}

function normalizeProgressRecord(encounter: Record<string, unknown>, target: WclGuildProgressTarget): WclGuildProgressRecord | null {
  const bossName = getProgressEncounterName(encounter);

  if (!bossName) {
    return null;
  }

  const classification = getCanonicalRaidClassification(target.zoneName, bossName, [target.tierSlug]);

  if (!classification || classification.tierSlug !== target.tierSlug) {
    return null;
  }

  const isKilled = encounter.isKilled === true || cleanText(encounter.status).toLowerCase() === "killed";
  const killDate = toIsoString(encounter.killedAtTimestamp ?? encounter.killTimestamp ?? encounter.firstKillTimestamp);
  const bestPercent = normalizePercentage(encounter.bestPercent ?? encounter.bestPercentage);
  const reportCode = getProgressReportCode(encounter);

  if (!isKilled && bestPercent === null) {
    return null;
  }

  return {
    bossName,
    encounterId: toNumber(encounter.id ?? encounter.encounterID ?? encounter.encounterId),
    raidName: classification.raidName,
    expansionSlug: classification.expansionSlug,
    tierSlug: classification.tierSlug,
    difficulty: target.difficulty,
    difficultyId: target.difficultyId,
    rawDifficultyId: target.difficultyId,
    status: isKilled ? "Killed" : "Best Pull",
    firstKillDate: isKilled ? killDate : null,
    latestKillDate: isKilled ? killDate : null,
    bestPercent: isKilled ? 0 : bestPercent,
    pulls: Math.max(0, Math.floor(toNumber(encounter.pullCount ?? encounter.pulls) ?? 0)),
    kills: isKilled ? 1 : 0,
    reportCode,
    reportUrl: getProgressReportUrl(encounter, reportCode),
    sourceGuildId: target.guildId,
    sourceGuildName: target.guildName,
    sourceServerSlug: target.serverSlug,
    sourceRegion: target.region,
    sourceLabel: target.sourceLabel,
    progressZoneId: target.zoneId,
    progressZoneName: target.zoneName,
  };
}

function dedupeProgressRecords(records: WclGuildProgressRecord[]) {
  const byKey = new Map<string, WclGuildProgressRecord>();

  for (const record of records) {
    const key = `${record.tierSlug}:${normalizeProgressionName(record.raidName)}:${normalizeProgressionName(record.bossName)}:${record.difficulty}`;
    const previous = byKey.get(key);

    if (!previous) {
      byKey.set(key, record);
      continue;
    }

    const firstKillDate = [previous.firstKillDate, record.firstKillDate].filter(Boolean).sort()[0] ?? null;
    const latestKillDate = [previous.latestKillDate, record.latestKillDate].filter(Boolean).sort().at(-1) ?? null;

    byKey.set(key, {
      ...previous,
      status: previous.status === "Killed" || record.status === "Killed" ? "Killed" : "Best Pull",
      firstKillDate,
      latestKillDate,
      bestPercent:
        previous.status === "Killed" || record.status === "Killed"
          ? 0
          : [previous.bestPercent, record.bestPercent].filter((value): value is number => typeof value === "number").sort((a, b) => a - b)[0] ?? null,
      pulls: Math.max(previous.pulls, record.pulls),
      kills: Math.max(previous.kills, record.kills),
      reportCode: firstKillDate === record.firstKillDate ? record.reportCode : previous.reportCode,
      reportUrl: firstKillDate === record.firstKillDate ? record.reportUrl : previous.reportUrl,
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.tierSlug.localeCompare(b.tierSlug) ||
      a.raidName.localeCompare(b.raidName) ||
      a.bossName.localeCompare(b.bossName) ||
      a.difficulty.localeCompare(b.difficulty),
  );
}

async function fetchGuildProgressTarget(accessToken: string, target: WclGuildProgressTarget): Promise<WclGuildProgressTargetResult> {
  const data = await requestGraphQl<WclGuildProgressQueryData>(accessToken, guildProgressRaceQuery, {
    guildId: target.guildId,
    zoneId: target.zoneId,
    difficulty: target.difficultyId,
    size: target.size,
  });
  const payload = data.progressRaceData?.progressRace;
  const guildPayload = findProgressGuildPayload(payload, target);

  if (!guildPayload) {
    return {
      ...target,
      available: false,
      reason: "Warcraft Logs progressRace did not return an encounter list for this guild.",
      killedCount: null,
      records: [],
    };
  }

  const records = dedupeProgressRecords(
    ((guildPayload.encounters as unknown[]) ?? [])
      .filter(isRecord)
      .map((encounter) => normalizeProgressRecord(encounter, target))
      .filter((record): record is WclGuildProgressRecord => Boolean(record)),
  );

  return {
    ...target,
    available: true,
    reason: null,
    killedCount: toNumber(guildPayload.killedCount),
    records,
  };
}

function emptyGuildProgressData(): WclGuildProgressData {
  return { targets: [] };
}

function getExistingGuildProgressTarget(existing: WclGuildProgressData | null, target: WclGuildProgressTarget) {
  return existing?.targets.find(
    (result) =>
      result.guildId === target.guildId &&
      result.zoneId === target.zoneId &&
      result.tierSlug === target.tierSlug &&
      result.difficultyId === target.difficultyId,
  );
}

async function fetchGuildProgressData(
  accessToken: string,
  existingData: WclGuildProgressData | null,
): Promise<{ data: WclGuildProgressData; failedTargets: WclGuildProgressTarget[] }> {
  const targets = getGuildProgressTargets();
  const results: WclGuildProgressTargetResult[] = [];
  const failedTargets: WclGuildProgressTarget[] = [];

  for (const target of targets) {
    console.log(`Syncing WCL guild progress: ${target.sourceLabel} zone ${target.zoneId} (${target.tierSlug})`);

    try {
      const result = await fetchGuildProgressTarget(accessToken, target);
      console.log(`Fetched ${result.records.length} guild progress record(s) from ${target.sourceLabel} zone ${target.zoneId}.`);
      results.push(result);
    } catch (error) {
      failedTargets.push(target);
      console.error(`WCL guild progress failed for ${target.sourceLabel} zone ${target.zoneId}: ${error instanceof Error ? error.message : String(error)}`);

      const preserved = getExistingGuildProgressTarget(existingData, target);

      if (preserved) {
        results.push(preserved);
        console.error(`Preserving ${preserved.records.length} existing guild progress record(s) for ${target.sourceLabel} zone ${target.zoneId}.`);
      }
    }
  }

  return {
    data: {
      targets: results.sort(
        (a, b) =>
          a.sourceLabel.localeCompare(b.sourceLabel) ||
          a.zoneId - b.zoneId ||
          a.tierSlug.localeCompare(b.tierSlug) ||
          a.difficulty.localeCompare(b.difficulty),
      ),
    },
    failedTargets,
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
  const tierSlug = reports.map(getReportTierSlug).find(Boolean);
  const preferred = reports.filter((report) => sourceMatchesTier(getConfiguredSourceByLabel(getReportSourceLabel(report)), tierSlug));
  if (preferred.length > 0) {
    return preferred.sort(
      (a, b) =>
        compareNullableIsoDates(b.startTime, a.startTime) ||
        getReportSourceLabel(a).localeCompare(getReportSourceLabel(b)) ||
        a.code.localeCompare(b.code),
    );
  }

  const candidates = reports;
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

type RaidClassification = {
  raidName: string;
  expansionSlug: string;
  tierSlug: string;
};

function addClassification(map: Map<string, RaidClassification[]>, key: string, classification: RaidClassification) {
  const normalizedKey = normalizeProgressionName(key);
  map.set(normalizedKey, [...(map.get(normalizedKey) ?? []), classification]);
}

const zoneClassifications = new Map<string, RaidClassification[]>();
const encounterClassifications = new Map<string, RaidClassification[]>();

function addRaidZone(raidName: string, expansionSlug: string, tierSlug: string, aliases: string[] = []) {
  const classification = { raidName, expansionSlug, tierSlug };

  for (const alias of [raidName, ...aliases]) {
    addClassification(zoneClassifications, alias, classification);
  }
}

function addRaidEncounters(raidName: string, expansionSlug: string, tierSlug: string, bosses: string[]) {
  const classification = { raidName, expansionSlug, tierSlug };

  for (const boss of bosses) {
    addClassification(encounterClassifications, boss, classification);
  }
}

addRaidZone("Molten Core", "classic", "classic-mc-ony");
addRaidZone("Onyxia's Lair", "classic", "classic-mc-ony", ["Onyxia"]);
addRaidZone("Blackwing Lair", "classic", "classic-bwl");
addRaidZone("Ruins of Ahn'Qiraj", "classic", "classic-aq");
addRaidZone("Temple of Ahn'Qiraj", "classic", "classic-aq", ["Ahn'Qiraj"]);
addRaidZone("Naxxramas", "classic", "classic-naxx");
addRaidZone("Karazhan", "tbc", "tbc-tier-4");
addRaidZone("Gruul's Lair", "tbc", "tbc-tier-4", ["Gruul / Magtheridon", "Gruul"]);
addRaidZone("Magtheridon's Lair", "tbc", "tbc-tier-4", ["Magtheridon"]);
addRaidZone("Serpentshrine Cavern", "tbc", "tbc-tier-5", ["SSC / TK", "Serpentshrine Cavern / Tempest Keep"]);
addRaidZone("Tempest Keep", "tbc", "tbc-tier-5", ["The Eye", "Serpentshrine Cavern / The Eye"]);
addRaidZone("Mount Hyjal", "tbc", "tbc-tier-6", ["BT / Hyjal", "Black Temple / Hyjal", "Hyjal Summit"]);
addRaidZone("Black Temple", "tbc", "tbc-tier-6");
addRaidZone("Sunwell Plateau", "tbc", "tbc-sunwell");
addRaidZone("Naxxramas", "wrath", "wrath-tier-7", ["Naxx / Sarth / Maly", "Naxxramas / Obsidian Sanctum / Eye of Eternity"]);
addRaidZone("The Obsidian Sanctum", "wrath", "wrath-tier-7", ["Obsidian Sanctum"]);
addRaidZone("The Eye of Eternity", "wrath", "wrath-tier-7", ["Eye of Eternity"]);
addRaidZone("Ulduar", "wrath", "wrath-tier-8");
addRaidZone("Trial of the Crusader", "wrath", "wrath-tier-9");
addRaidZone("Onyxia's Lair", "wrath", "wrath-tier-9", ["Onyxia"]);
addRaidZone("Icecrown Citadel", "wrath", "wrath-tier-10");
addRaidZone("The Ruby Sanctum", "wrath", "wrath-tier-10", ["Ruby Sanctum"]);
addRaidZone("Blackwing Descent", "cata", "cata-tier-11", ["TotFW / BWD / BoT", "Throne of the Four Winds / Blackwing Descent / Bastion of Twilight"]);
addRaidZone("The Bastion of Twilight", "cata", "cata-tier-11", ["Bastion of Twilight"]);
addRaidZone("Throne of the Four Winds", "cata", "cata-tier-11");
addRaidZone("Firelands", "cata", "cata-tier-12");
addRaidZone("Dragon Soul", "cata", "cata-tier-13");
addRaidZone("Mogu'shan Vaults", "mop", "tier-14", ["Mogushan Vaults"]);
addRaidZone("Heart of Fear", "mop", "tier-14");
addRaidZone("Terrace of Endless Spring", "mop", "tier-14");
addRaidZone("Throne of Thunder", "mop", "tier-15");
addRaidZone("Siege of Orgrimmar", "mop", "tier-16");

addRaidEncounters("Molten Core", "classic", "classic-mc-ony", ["Lucifron", "Magmadar", "Gehennas", "Garr", "Baron Geddon", "Shazzrah", "Sulfuron Harbinger", "Golemagg the Incinerator", "Majordomo Executus", "Ragnaros"]);
addRaidEncounters("Onyxia's Lair", "classic", "classic-mc-ony", ["Onyxia"]);
addRaidEncounters("Blackwing Lair", "classic", "classic-bwl", ["Razorgore the Untamed", "Vaelastrasz the Corrupt", "Broodlord Lashlayer", "Firemaw", "Ebonroc", "Flamegor", "Chromaggus", "Nefarian"]);
addRaidEncounters("Ruins of Ahn'Qiraj", "classic", "classic-aq", ["Kurinnaxx", "General Rajaxx", "Moam", "Buru the Gorger", "Ayamiss the Hunter", "Ossirian the Unscarred"]);
addRaidEncounters("Temple of Ahn'Qiraj", "classic", "classic-aq", ["The Prophet Skeram", "Silithid Royalty", "Battleguard Sartura", "Fankriss the Unyielding", "Viscidus", "Princess Huhuran", "Twin Emperors", "Ouro", "C'Thun"]);
addRaidEncounters("Naxxramas", "classic", "classic-naxx", ["Anub'Rekhan", "Grand Widow Faerlina", "Maexxna", "Noth the Plaguebringer", "Heigan the Unclean", "Loatheb", "Instructor Razuvious", "Gothik the Harvester", "The Four Horsemen", "Patchwerk", "Grobbulus", "Gluth", "Thaddius", "Sapphiron", "Kel'Thuzad"]);
addRaidEncounters("Karazhan", "tbc", "tbc-tier-4", ["Attumen the Huntsman", "Moroes", "Maiden of Virtue", "Opera Event", "The Curator", "Terestian Illhoof", "Shade of Aran", "Netherspite", "Chess Event", "Prince Malchezaar", "Nightbane"]);
addRaidEncounters("Gruul's Lair", "tbc", "tbc-tier-4", ["High King Maulgar", "Gruul the Dragonkiller"]);
addRaidEncounters("Magtheridon's Lair", "tbc", "tbc-tier-4", ["Magtheridon"]);
addRaidEncounters("Serpentshrine Cavern", "tbc", "tbc-tier-5", ["Hydross the Unstable", "The Lurker Below", "Leotheras the Blind", "Fathom-Lord Karathress", "Morogrim Tidewalker", "Lady Vashj"]);
addRaidEncounters("Tempest Keep", "tbc", "tbc-tier-5", ["Al'ar", "Void Reaver", "High Astromancer Solarian", "Kael'thas Sunstrider"]);
addRaidEncounters("Mount Hyjal", "tbc", "tbc-tier-6", ["Rage Winterchill", "Anetheron", "Kaz'rogal", "Azgalor", "Archimonde"]);
addRaidEncounters("Black Temple", "tbc", "tbc-tier-6", ["High Warlord Naj'entus", "Supremus", "Shade of Akama", "Teron Gorefiend", "Gurtogg Bloodboil", "Reliquary of Souls", "Mother Shahraz", "The Illidari Council", "Illidan Stormrage"]);
addRaidEncounters("Sunwell Plateau", "tbc", "tbc-sunwell", ["Kalecgos", "Brutallus", "Felmyst", "Eredar Twins", "M'uru", "Kil'jaeden"]);
addRaidEncounters("Naxxramas", "wrath", "wrath-tier-7", ["Anub'Rekhan", "Grand Widow Faerlina", "Maexxna", "Noth the Plaguebringer", "Heigan the Unclean", "Loatheb", "Instructor Razuvious", "Gothik the Harvester", "The Four Horsemen", "Patchwerk", "Grobbulus", "Gluth", "Thaddius", "Sapphiron", "Kel'Thuzad"]);
addRaidEncounters("The Obsidian Sanctum", "wrath", "wrath-tier-7", ["Sartharion"]);
addRaidEncounters("The Eye of Eternity", "wrath", "wrath-tier-7", ["Malygos"]);
addRaidEncounters("Ulduar", "wrath", "wrath-tier-8", ["Flame Leviathan", "Ignis the Furnace Master", "Razorscale", "XT-002 Deconstructor", "Assembly of Iron", "Kologarn", "Auriaya", "Hodir", "Thorim", "Freya", "Mimiron", "General Vezax", "Yogg-Saron", "Algalon the Observer"]);
addRaidEncounters("Ulduar", "wrath", "wrath-tier-8", ["The Iron Council"]);
addRaidEncounters("Trial of the Crusader", "wrath", "wrath-tier-9", ["Northrend Beasts", "Lord Jaraxxus", "Faction Champions", "Twin Val'kyr", "Val'kyr Twins", "Anub'arak"]);
addRaidEncounters("Onyxia's Lair", "wrath", "wrath-tier-9", ["Onyxia"]);
addRaidEncounters("Icecrown Citadel", "wrath", "wrath-tier-10", ["Lord Marrowgar", "Lady Deathwhisper", "Gunship Battle", "Deathbringer Saurfang", "Festergut", "Rotface", "Professor Putricide", "Blood Prince Council", "Blood-Queen Lana'thel", "Valithria Dreamwalker", "Sindragosa", "The Lich King"]);
addRaidEncounters("The Ruby Sanctum", "wrath", "wrath-tier-10", ["Saviana Ragefire", "Baltharus the Warborn", "General Zarithrian", "Halion"]);
addRaidEncounters("Blackwing Descent", "cata", "cata-tier-11", ["Magmaw", "Omnotron Defense System", "Maloriak", "Atramedes", "Chimaeron", "Nefarian's End"]);
addRaidEncounters("The Bastion of Twilight", "cata", "cata-tier-11", ["Halfus Wyrmbreaker", "Valiona & Theralion", "Ascendant Council", "Cho'gall", "Sinestra"]);
addRaidEncounters("Throne of the Four Winds", "cata", "cata-tier-11", ["Conclave of Wind", "Al'Akir"]);
addRaidEncounters("Firelands", "cata", "cata-tier-12", ["Beth'tilac", "Lord Rhyolith", "Alysrazor", "Shannox", "Baleroc", "Majordomo Staghelm", "Ragnaros"]);
addRaidEncounters("Dragon Soul", "cata", "cata-tier-13", ["Morchok", "Warlord Zon'ozz", "Yor'sahj the Unsleeping", "Hagara the Stormbinder", "Ultraxion", "Warmaster Blackhorn", "Spine of Deathwing", "Madness of Deathwing"]);
addRaidEncounters("Mogu'shan Vaults", "mop", "tier-14", ["The Stone Guard", "Feng the Accursed", "Gara'jal the Spiritbinder", "The Spirit Kings", "Elegon", "Will of the Emperor"]);
addRaidEncounters("Heart of Fear", "mop", "tier-14", ["Imperial Vizier Zor'lok", "Blade Lord Ta'yak", "Garalon", "Wind Lord Mel'jarak", "Amber-Shaper Un'sok", "Grand Empress Shek'zeer"]);
addRaidEncounters("Terrace of Endless Spring", "mop", "tier-14", ["Protectors of the Endless", "Tsulong", "Lei Shi", "Sha of Fear"]);
addRaidEncounters("Throne of Thunder", "mop", "tier-15", ["Jin'rokh the Breaker", "Horridon", "Council of Elders", "Tortos", "Megaera", "Ji-Kun", "Durumu the Forgotten", "Primordius", "Dark Animus", "Iron Qon", "Twin Consorts", "Twin Empyreans", "Lei Shen", "Ra-den"]);
addRaidEncounters("Siege of Orgrimmar", "mop", "tier-16", ["Immerseus", "The Fallen Protectors", "Norushen", "Sha of Pride", "Galakras", "Iron Juggernaut", "Kor'kron Dark Shaman", "General Nazgrim", "Malkorok", "Spoils of Pandaria", "Thok the Bloodthirsty", "Siegecrafter Blackfuse", "Paragons of the Klaxxi", "Garrosh Hellscream"]);

const canonicalTbcTier5Raids = [
  {
    raidName: "Serpentshrine Cavern",
    bosses: [
      "Hydross the Unstable",
      "The Lurker Below",
      "Leotheras the Blind",
      "Fathom-Lord Karathress",
      "Morogrim Tidewalker",
      "Lady Vashj",
    ],
  },
  {
    raidName: "Tempest Keep",
    bosses: ["Al'ar", "Void Reaver", "High Astromancer Solarian", "Kael'thas Sunstrider"],
  },
];

function selectClassification(candidates: RaidClassification[] | undefined, sourceTiers: string[] = []) {
  if (!candidates?.length) {
    return null;
  }

  const matched = candidates.find((candidate) => sourceTiers.includes(candidate.tierSlug));

  if (sourceTiers.length > 0) {
    return matched ?? null;
  }

  return matched ?? candidates[0];
}

function getCanonicalRaidClassification(zoneName: string, fightName: string, sourceTiers: string[] = []) {
  const normalizedFight = normalizeProgressionName(fightName);
  const directFight = selectClassification(encounterClassifications.get(normalizedFight), sourceTiers);

  if (directFight) {
    return directFight;
  }

  for (const [encounterName, candidates] of encounterClassifications) {
    if (normalizedFight.includes(encounterName)) {
      const inferred = selectClassification(candidates, sourceTiers);

      if (inferred) {
        return inferred;
      }
    }
  }

  if (normalizedFight) {
    return null;
  }

  return selectClassification(zoneClassifications.get(normalizeProgressionName(zoneName)), sourceTiers);
}

function getReportTierSlug(report: WclReport) {
  for (const fight of report.fights) {
    const classification = getCanonicalRaidClassification(report.zone.name, fight.name, report.sourceTiers);

    if (classification) {
      return classification.tierSlug;
    }
  }

  return getCanonicalRaidClassification(report.zone.name, "", report.sourceTiers)?.tierSlug ??
    (report.sourceTiers.length > 0 ? undefined : getTierForRaidName(report.zone.name)?.slug);
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

function updateProgressionDifficultyFromGuildProgress(difficulty: DifficultyDraft, record: WclGuildProgressRecord) {
  if (difficulty.difficultyId === null) {
    difficulty.difficultyId = record.difficultyId;
  }

  if (difficulty.rawDifficultyId === null) {
    difficulty.rawDifficultyId = record.rawDifficultyId;
  }

  difficulty.pulls = Math.max(difficulty.pulls, record.pulls);

  if (record.status === "Killed") {
    const killDate = record.firstKillDate ?? record.latestKillDate;
    const killSortTime = getDateSortTime(killDate);

    difficulty.status = "Killed";
    difficulty.kills = Math.max(difficulty.kills, record.kills || 1);
    difficulty.bestPercent = 0;

    if (killSortTime !== null && (difficulty.firstKillSortTime === null || killSortTime < difficulty.firstKillSortTime)) {
      difficulty.firstKillSortTime = killSortTime;
      difficulty.firstKillDate = killDate;
      difficulty.reportCode = record.reportCode;
      difficulty.reportUrl = record.reportUrl;
    }

    if (killSortTime !== null && (difficulty.latestKillSortTime === null || killSortTime > difficulty.latestKillSortTime)) {
      difficulty.latestKillSortTime = killSortTime;
      difficulty.latestKillDate = killDate;
    }

    return;
  }

  if (difficulty.status === "Killed" || record.bestPercent === null) {
    return;
  }

  if (difficulty.bestPercent === null || record.bestPercent < difficulty.bestPercent) {
    difficulty.bestPercent = record.bestPercent;
    difficulty.reportCode = record.reportCode;
    difficulty.reportUrl = record.reportUrl;
  }
}

function getOrCreateRaidDraft(
  raidDrafts: Map<string, RaidDraft>,
  classification: RaidClassification,
  source: Pick<WclGuildProgressRecord, "sourceGuildId" | "sourceGuildName" | "sourceServerSlug" | "sourceRegion" | "sourceLabel">,
) {
  const raidKey = `${classification.tierSlug}:${normalizeProgressionName(classification.raidName)}`;
  const raid =
    raidDrafts.get(raidKey) ??
    ({
      name: classification.raidName,
      zoneId: null,
      expansionSlug: classification.expansionSlug,
      tierSlug: classification.tierSlug,
      sourceGuildId: source.sourceGuildId,
      sourceGuildName: source.sourceGuildName,
      sourceServerSlug: source.sourceServerSlug,
      sourceRegion: source.sourceRegion,
      sourceLabel: source.sourceLabel,
      sourceLabels: new Set<string>(),
      bosses: new Map<string, BossDraft>(),
    } satisfies RaidDraft);
  raidDrafts.set(raidKey, raid);
  raid.sourceLabels.add(source.sourceLabel);

  return raid;
}

function applyGuildProgressSupplement(raidDrafts: Map<string, RaidDraft>, guildProgressData: WclGuildProgressData) {
  for (const target of guildProgressData.targets) {
    for (const record of target.records) {
      if (record.status !== "Killed") {
        continue;
      }

      const classification = {
        raidName: record.raidName,
        expansionSlug: record.expansionSlug,
        tierSlug: record.tierSlug,
      };
      const raid = getOrCreateRaidDraft(raidDrafts, classification, record);
      const bossKey = normalizeProgressionName(record.bossName) || `${record.encounterId ?? "unknown"}:${record.bossName}`;
      const boss =
        raid.bosses.get(bossKey) ??
        ({
          name: record.bossName,
          encounterId: record.encounterId,
          difficulties: new Map<string, DifficultyDraft>(),
        } satisfies BossDraft);
      raid.bosses.set(bossKey, boss);

      if (boss.encounterId === null && record.encounterId !== null) {
        boss.encounterId = record.encounterId;
      }

      const difficulty = boss.difficulties.get(record.difficulty) ?? createDifficultyDraft();
      boss.difficulties.set(record.difficulty, difficulty);
      updateProgressionDifficultyFromGuildProgress(difficulty, record);
    }
  }
}

function getSourceLabelsForTier(tierSlug: string) {
  return guildSources
    .filter((source) => source.tiers.includes(tierSlug))
    .map((source) => source.label)
    .sort((a, b) => a.localeCompare(b));
}

function ensureTbcTier5Coverage(raidDrafts: Map<string, RaidDraft>) {
  const hasTier5Data = [...raidDrafts.values()].some((raid) => raid.tierSlug === "tbc-tier-5");

  if (!hasTier5Data) {
    return;
  }

  const tierSourceLabels = getSourceLabelsForTier("tbc-tier-5");

  for (const canonicalRaid of canonicalTbcTier5Raids) {
    const raidKey = `tbc-tier-5:${normalizeProgressionName(canonicalRaid.raidName)}`;
    const raid =
      raidDrafts.get(raidKey) ??
      ({
        name: canonicalRaid.raidName,
        zoneId: null,
        expansionSlug: "tbc",
        tierSlug: "tbc-tier-5",
        sourceGuildId: null,
        sourceGuildName: null,
        sourceServerSlug: null,
        sourceRegion: null,
        sourceLabel: null,
        sourceLabels: new Set<string>(),
        bosses: new Map<string, BossDraft>(),
      } satisfies RaidDraft);
    raidDrafts.set(raidKey, raid);

    for (const label of tierSourceLabels) {
      raid.sourceLabels.add(label);
    }

    for (const bossName of canonicalRaid.bosses) {
      const bossKey = normalizeProgressionName(bossName);

      if (!raid.bosses.has(bossKey)) {
        raid.bosses.set(bossKey, {
          name: bossName,
          encounterId: null,
          difficulties: new Map<string, DifficultyDraft>(),
        });
      }
    }
  }
}

function buildProgressionSeed(reportsData: WclReportsData, guildProgressData: WclGuildProgressData = emptyGuildProgressData()): WclProgressionSeed {
  const raidDrafts = new Map<string, RaidDraft>();
  const reportsByRaid = new Map<string, WclReport[]>();

  for (const report of reportsData.reports) {
    const raidKey = `${report.zone.id ?? "unknown"}:${report.zone.name}`;
    reportsByRaid.set(raidKey, [...(reportsByRaid.get(raidKey) ?? []), report]);
  }

  for (const reports of [...reportsByRaid.values()].map(chooseReportsForRaid)) {
    if (reports.length === 0) {
      continue;
    }

    for (const report of reports) {
      for (const fight of report.fights) {
        if (!fight.encounterId) {
          continue;
        }

        const classification = getCanonicalRaidClassification(report.zone.name, fight.name, report.sourceTiers);
        if (!classification) {
          continue;
        }

        const raidKey = `${classification.tierSlug}:${normalizeProgressionName(classification.raidName) || `${report.zone.id ?? "unknown"}:${report.zone.name}`}`;
        const raid =
          raidDrafts.get(raidKey) ??
          ({
            name: classification.raidName,
            zoneId: report.zone.id,
            expansionSlug: classification.expansionSlug,
            tierSlug: classification.tierSlug,
            sourceGuildId: report.sourceGuildId,
            sourceGuildName: report.sourceGuildName,
            sourceServerSlug: report.sourceServerSlug,
            sourceRegion: report.sourceRegion,
            sourceLabel: report.sourceLabel,
            sourceLabels: new Set<string>(),
            bosses: new Map<string, BossDraft>(),
          } satisfies RaidDraft);
        raidDrafts.set(raidKey, raid);
        raid.sourceLabels.add(getReportSourceLabel(report));

        const bossKey = normalizeProgressionName(fight.name) || `${fight.encounterId}:${fight.name}`;
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

  applyGuildProgressSupplement(raidDrafts, guildProgressData);
  ensureTbcTier5Coverage(raidDrafts);

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
        expansionSlug: raid.expansionSlug,
        tierSlug: raid.tierSlug,
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
    .filter((raid) => raid.bosses.length > 0)
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

function buildSyncMeta(reportsData: WclReportsData, guildProgressData: WclGuildProgressData): WclSyncMeta {
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
    guildProgressRecordsSynced: guildProgressData.targets.reduce((sum, target) => sum + target.records.length, 0),
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
  const existingGuildProgressData = await readJsonIfExists<WclGuildProgressData>("src/data/wclGuildProgress.json");
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
  const { data: guildProgressData, failedTargets: failedGuildProgressTargets } = await fetchGuildProgressData(accessToken, existingGuildProgressData);
  if (reportsData.reports.length === 0 && existingReports.length > 0) {
    console.error("Warcraft Logs sources returned no reports. Preserving existing Warcraft Logs JSON files.");
    return;
  }

  const progressionSeed = buildProgressionSeed(reportsData, guildProgressData);
  const rankingsData = buildRankingsFallback(progressionSeed);
  const sourceFiles: Array<{ path: string; data: unknown }> = [
    { path: "src/data/wclReports.json", data: reportsData },
    { path: "src/data/wclProgressionSeed.json", data: progressionSeed },
    { path: "src/data/wclRankings.json", data: rankingsData },
  ];
  if (guildProgressData.targets.length > 0 || existingGuildProgressData) {
    sourceFiles.splice(1, 0, { path: "src/data/wclGuildProgress.json", data: guildProgressData });
  }
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
    const syncMeta = buildSyncMeta(reportsData, guildProgressData);

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
  if (failedGuildProgressTargets.length > 0) {
    console.log(
      `Failed guild progress targets preserved when possible: ${failedGuildProgressTargets
        .map((target) => `${target.sourceLabel} zone ${target.zoneId}`)
        .join(", ")}`,
    );
  }
  console.log(`Report limit: ${reportLimit}`);
  console.log(`Report pages: ${reportPages}`);
  console.log(`Reports synced: ${reportsData.reports.length}`);
  console.log(`Fights synced: ${reportsData.reports.reduce((sum, report) => sum + report.fights.length, 0)}`);
  console.log(`Guild progress records synced: ${guildProgressData.targets.reduce((sum, target) => sum + target.records.length, 0)}`);
  console.log(`Files changed: ${changedFiles.length}`);

  if (changedFiles.length > 0) {
    console.log(`Changed files: ${changedFiles.join(", ")}`);
  }
}

await runWarcraftLogsSync().catch((error: unknown) => {
  console.error(`Warcraft Logs sync failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error("Preserving existing Warcraft Logs JSON files.");
});
