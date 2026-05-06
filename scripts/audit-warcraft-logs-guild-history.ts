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

type WclApiFight = {
  id?: number | null;
  name?: string | null;
  encounterID?: number | null;
  difficulty?: number | string | null;
  kill?: boolean | null;
};

type WclApiReport = {
  code?: string | null;
  title?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  zone?: {
    id?: number | null;
    name?: string | null;
  } | null;
  fights?: WclApiFight[] | null;
};

type WclReportsQueryData = {
  reportData?: {
    reports?: {
      data?: WclApiReport[] | null;
      total?: number | null;
      current_page?: number | null;
      last_page?: number | null;
    } | null;
  } | null;
};

type WclGuildMetadataQueryData = {
  guildData?: {
    guild?: {
      id?: number | null;
      name?: string | null;
      server?: {
        name?: string | null;
        slug?: string | null;
        region?: {
          name?: string | null;
          slug?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type GuildMetadata = {
  id: number;
  name: string;
  serverName: string;
  serverSlug: string;
  region: string;
};

type CurrentGuildSource = {
  auditId: number;
  guildName: string;
  serverSlug: string;
  serverName: string;
  region: string;
  label: string;
};

type AuditFight = {
  id: number | null;
  name: string;
  encounterId: number | null;
  difficultyId: number | string | null;
  kill: boolean;
};

type AuditReport = {
  guildId: number;
  code: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  zoneId: number | null;
  zoneName: string;
  fights: AuditFight[];
};

type ZoneClassification = {
  expansion: string;
  tier: string;
  zoneName: string;
};

type GuildAudit = {
  guildId: number;
  metadata: GuildMetadata | null;
  reports: AuditReport[];
  error: string | null;
};

type CoverageSummary = {
  guildId: number;
  expansion: string;
  tier: string;
  zones: Set<string>;
  reportCodes: Set<string>;
  killCount: number;
  firstDate: string | null;
  lastDate: string | null;
  exampleReportCode: string | null;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://classic.warcraftlogs.com/api/v2/client";
const tokenEndpoint = "https://www.warcraftlogs.com/oauth/token";
const reportUrlBase = "https://classic.warcraftlogs.com/reports";

loadEnv({ path: path.join(root, ".env.local"), override: false });
loadEnv({ path: path.join(root, ".env"), override: false });

const defaultGuildIds = [482914, 619658, 738773];
const guildIds = getAuditGuildIds(process.env.WCL_AUDIT_GUILD_IDS);
const currentGuild = getCurrentGuildSource();
const reportLimit = getPositiveInteger(process.env.WCL_REPORT_LIMIT, 20, 100);
const reportPages = getPositiveInteger(process.env.WCL_REPORT_PAGES, 25, 100);

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
        }
      }
      total
      current_page
      last_page
    }
  }
}
`;

const guildReportsByNameQuery = `
query GuildReportsByName($guildName: String!, $serverSlug: String!, $serverRegion: String!, $limit: Int!, $page: Int!) {
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
        }
      }
      total
      current_page
      last_page
    }
  }
}
`;

// Metadata is best-effort only. reportData.reports is the audit source of truth.
const guildMetadataQuery = `
query GuildMetadata($guildId: Int!) {
  guildData {
    guild(id: $guildId) {
      id
      name
      server {
        name
        slug
        region {
          name
          slug
        }
      }
    }
  }
}
`;

const zoneCatalog = [
  // Classic Era
  { names: ["Molten Core"], expansion: "Classic Era", tier: "Molten Core / Onyxia" },
  { names: ["Onyxia's Lair"], expansion: "Classic Era", tier: "Molten Core / Onyxia" },
  { names: ["Blackwing Lair"], expansion: "Classic Era", tier: "Blackwing Lair" },
  { names: ["Zul'Gurub"], expansion: "Classic Era", tier: "Zul'Gurub" },
  { names: ["Ruins of Ahn'Qiraj"], expansion: "Classic Era", tier: "Ruins of Ahn'Qiraj" },
  { names: ["Ahn'Qiraj", "Temple of Ahn'Qiraj"], expansion: "Classic Era", tier: "Ahn'Qiraj" },
  { names: ["Naxxramas"], expansion: "Classic Era", tier: "Naxxramas" },

  // The Burning Crusade Classic
  { names: ["Karazhan"], expansion: "The Burning Crusade Classic", tier: "Tier 4" },
  { names: ["Gruul's Lair"], expansion: "The Burning Crusade Classic", tier: "Tier 4" },
  { names: ["Magtheridon's Lair"], expansion: "The Burning Crusade Classic", tier: "Tier 4" },
  { names: ["Serpentshrine Cavern"], expansion: "The Burning Crusade Classic", tier: "Tier 5" },
  { names: ["The Eye", "Tempest Keep"], expansion: "The Burning Crusade Classic", tier: "Tier 5" },
  { names: ["Mount Hyjal", "Hyjal Summit"], expansion: "The Burning Crusade Classic", tier: "Black Temple / Hyjal" },
  { names: ["Black Temple"], expansion: "The Burning Crusade Classic", tier: "Black Temple / Hyjal" },
  { names: ["Zul'Aman"], expansion: "The Burning Crusade Classic", tier: "Zul'Aman" },
  { names: ["Sunwell Plateau"], expansion: "The Burning Crusade Classic", tier: "Sunwell Plateau" },

  // Wrath of the Lich King Classic
  { names: ["The Obsidian Sanctum", "Obsidian Sanctum"], expansion: "Wrath of the Lich King Classic", tier: "Tier 7" },
  { names: ["The Eye of Eternity", "Eye of Eternity"], expansion: "Wrath of the Lich King Classic", tier: "Tier 7" },
  { names: ["Ulduar"], expansion: "Wrath of the Lich King Classic", tier: "Tier 8" },
  { names: ["Trial of the Crusader"], expansion: "Wrath of the Lich King Classic", tier: "Tier 9" },
  { names: ["Icecrown Citadel"], expansion: "Wrath of the Lich King Classic", tier: "Tier 10" },
  { names: ["The Ruby Sanctum", "Ruby Sanctum"], expansion: "Wrath of the Lich King Classic", tier: "Ruby Sanctum" },

  // Cataclysm Classic
  { names: ["Blackwing Descent"], expansion: "Cataclysm Classic", tier: "Tier 11" },
  { names: ["The Bastion of Twilight", "Bastion of Twilight"], expansion: "Cataclysm Classic", tier: "Tier 11" },
  { names: ["Throne of the Four Winds"], expansion: "Cataclysm Classic", tier: "Tier 11" },
  { names: ["Firelands"], expansion: "Cataclysm Classic", tier: "Tier 12" },
  { names: ["Dragon Soul"], expansion: "Cataclysm Classic", tier: "Tier 13" },

  // Mists of Pandaria Classic
  { names: ["Mogu'shan Vaults", "Mogushan Vaults"], expansion: "Mists of Pandaria Classic", tier: "Tier 14" },
  { names: ["Heart of Fear"], expansion: "Mists of Pandaria Classic", tier: "Tier 14" },
  { names: ["Terrace of Endless Spring"], expansion: "Mists of Pandaria Classic", tier: "Tier 14" },
  { names: ["Throne of Thunder"], expansion: "Mists of Pandaria Classic", tier: "Tier 15" },
  { names: ["Siege of Orgrimmar"], expansion: "Mists of Pandaria Classic", tier: "Tier 16" },
].flatMap((entry) =>
  entry.names.map((name) => ({
    normalizedName: normalizeName(name),
    displayName: name,
    expansion: entry.expansion,
    tier: entry.tier,
  })),
);

const mopTier14FightMap = new Map<string, ZoneClassification>([
  ["thestoneguard", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Mogu'shan Vaults" }],
  ["fengtheaccursed", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Mogu'shan Vaults" }],
  ["garajalthespiritbinder", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Mogu'shan Vaults" }],
  ["thespiritkings", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Mogu'shan Vaults" }],
  ["elegon", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Mogu'shan Vaults" }],
  ["willoftheemperor", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Mogu'shan Vaults" }],
  ["imperialvizierzorlok", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Heart of Fear" }],
  ["bladelordtayak", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Heart of Fear" }],
  ["garalon", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Heart of Fear" }],
  ["windlordmeljarak", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Heart of Fear" }],
  ["ambershaperunsok", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Heart of Fear" }],
  ["grandempressshekzeer", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Heart of Fear" }],
  ["protectorsoftheendless", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Terrace of Endless Spring" }],
  ["tsulong", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Terrace of Endless Spring" }],
  ["leishi", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Terrace of Endless Spring" }],
  ["shaoffear", { expansion: "Mists of Pandaria Classic", tier: "Tier 14", zoneName: "Terrace of Endless Spring" }],
]);

const plannedCoverage = new Map<string, string[]>([
  ["Classic Era", ["Molten Core / Onyxia", "Blackwing Lair", "Ahn'Qiraj", "Naxxramas"]],
  ["The Burning Crusade Classic", ["Tier 4", "Tier 5", "Black Temple / Hyjal", "Sunwell Plateau"]],
  ["Wrath of the Lich King Classic", ["Tier 7", "Tier 8", "Tier 9", "Tier 10"]],
  ["Cataclysm Classic", ["Tier 11", "Tier 12", "Tier 13"]],
  ["Mists of Pandaria Classic", ["Tier 14", "Tier 15", "Tier 16"]],
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(cleanText(value));

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function getAuditGuildIds(value: unknown) {
  const ids = cleanText(value)
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  return ids.length > 0 ? [...new Set(ids)] : defaultGuildIds;
}

function serverSlugToName(value: string) {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getCurrentGuildSource(): CurrentGuildSource {
  const guildName = cleanText(process.env.WCL_AUDIT_CURRENT_GUILD_NAME || process.env.WCL_GUILD_NAME) || "Vitality";
  const serverSlug = (cleanText(process.env.WCL_AUDIT_CURRENT_SERVER_SLUG || process.env.WCL_SERVER_SLUG) || "raden").toLowerCase();
  const serverName = cleanText(process.env.WCL_AUDIT_CURRENT_SERVER_NAME || process.env.WCL_SERVER_NAME) || serverSlugToName(serverSlug);
  const region = (cleanText(process.env.WCL_AUDIT_CURRENT_REGION || process.env.WCL_REGION) || "US").toUpperCase();

  return {
    auditId: 0,
    guildName,
    serverSlug,
    serverName,
    region,
    label: `${guildName} - ${serverName}`,
  };
}

function auditSourceLabel(guildId: number) {
  return guildId === currentGuild.auditId ? currentGuild.label : `Guild ${guildId}`;
}

function normalizeName(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value: unknown) {
  const parsed = toNumber(value);

  if (parsed === null || parsed <= 0) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function compareNullableDates(a: string | null, b: string | null) {
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

function md(value: unknown) {
  const text = cleanText(value);
  return text ? text.replace(/\|/g, "\\|") : "Unknown";
}

function mdList(values: Iterable<string>) {
  const uniqueValues = [...new Set([...values].map(cleanText).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return uniqueValues.length > 0 ? uniqueValues.join(", ") : "None";
}

async function requestAccessToken() {
  const clientId = cleanText(process.env.WCL_CLIENT_ID);
  const clientSecret = cleanText(process.env.WCL_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
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

async function fetchGuildMetadata(accessToken: string, guildId: number): Promise<GuildMetadata | null> {
  try {
    const data = await requestGraphQl<WclGuildMetadataQueryData>(accessToken, guildMetadataQuery, { guildId });
    const guild = data.guildData?.guild;

    if (!guild) {
      return null;
    }

    return {
      id: toNumber(guild.id) ?? guildId,
      name: cleanText(guild.name) || `Guild ${guildId}`,
      serverName: cleanText(guild.server?.name),
      serverSlug: cleanText(guild.server?.slug),
      region: cleanText(guild.server?.region?.slug || guild.server?.region?.name).toUpperCase(),
    };
  } catch (error) {
    console.warn(`Guild metadata lookup failed for ${guildId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function fetchGuildReports(accessToken: string, guildId: number) {
  const reports: WclApiReport[] = [];
  let pagesFetched = 0;

  for (let page = 1; page <= reportPages; page += 1) {
    const data = await requestGraphQl<WclReportsQueryData>(accessToken, guildReportsByGuildIdQuery, {
      guildId,
      limit: reportLimit,
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

  console.log(`Fetched ${reports.length} reports for guild ${guildId} across ${pagesFetched} page(s).`);

  return reports
    .map((report) => normalizeReport(guildId, report))
    .filter((report): report is AuditReport => Boolean(report))
    .sort((a, b) => compareNullableDates(a.startTime, b.startTime) || a.code.localeCompare(b.code));
}

async function fetchCurrentGuildReports(accessToken: string) {
  const reports: WclApiReport[] = [];
  let pagesFetched = 0;

  for (let page = 1; page <= reportPages; page += 1) {
    const data = await requestGraphQl<WclReportsQueryData>(accessToken, guildReportsByNameQuery, {
      guildName: currentGuild.guildName,
      serverSlug: currentGuild.serverSlug,
      serverRegion: currentGuild.region,
      limit: reportLimit,
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

  console.log(`Fetched ${reports.length} reports for ${currentGuild.label} across ${pagesFetched} page(s).`);

  return reports
    .map((report) => normalizeReport(currentGuild.auditId, report))
    .filter((report): report is AuditReport => Boolean(report))
    .sort((a, b) => compareNullableDates(a.startTime, b.startTime) || a.code.localeCompare(b.code));
}

function normalizeReport(guildId: number, report: WclApiReport): AuditReport | null {
  const code = cleanText(report.code);

  if (!code) {
    return null;
  }

  return {
    guildId,
    code,
    title: cleanText(report.title) || code,
    startTime: toIsoString(report.startTime),
    endTime: toIsoString(report.endTime),
    zoneId: toNumber(report.zone?.id),
    zoneName: cleanText(report.zone?.name) || "Unknown Zone",
    fights: (report.fights ?? [])
      .map((fight): AuditFight => ({
        id: toNumber(fight.id),
        name: cleanText(fight.name) || "Unknown Encounter",
        encounterId: toNumber(fight.encounterID),
        difficultyId: typeof fight.difficulty === "number" || typeof fight.difficulty === "string" ? fight.difficulty : null,
        kill: Boolean(fight.kill),
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0) || a.name.localeCompare(b.name)),
  };
}

function classifyReport(report: AuditReport): ZoneClassification | null {
  const normalizedZone = normalizeName(report.zoneName);
  const directMatch = zoneCatalog.find((zone) => zone.normalizedName === normalizedZone);

  if (directMatch) {
    if (normalizedZone === "naxxramas" && getReportYear(report) >= 2022) {
      return { expansion: "Wrath of the Lich King Classic", tier: "Tier 7", zoneName: "Naxxramas" };
    }

    if (normalizedZone === "onyxiaslair" && getReportYear(report) >= 2022) {
      return { expansion: "Wrath of the Lich King Classic", tier: "Onyxia's Lair", zoneName: "Onyxia's Lair" };
    }

    return {
      expansion: directMatch.expansion,
      tier: directMatch.tier,
      zoneName: directMatch.displayName,
    };
  }

  for (const fight of report.fights) {
    const classification = mopTier14FightMap.get(normalizeName(fight.name));

    if (classification) {
      return classification;
    }
  }

  return null;
}

function getReportYear(report: AuditReport) {
  const year = Number((report.startTime ?? report.endTime ?? "").slice(0, 4));
  return Number.isFinite(year) ? year : 0;
}

function updateDateRange(summary: CoverageSummary, report: AuditReport) {
  const date = report.startTime ?? report.endTime;

  if (!date) {
    return;
  }

  if (!summary.firstDate || date < summary.firstDate) {
    summary.firstDate = date;
  }

  if (!summary.lastDate || date > summary.lastDate) {
    summary.lastDate = date;
  }
}

function buildCoverage(audits: GuildAudit[]) {
  const coverage = new Map<string, CoverageSummary>();
  const unknownZones = new Map<number, Set<string>>();

  for (const audit of audits) {
    for (const report of audit.reports) {
      const classification = classifyReport(report);

      if (!classification) {
        const zones = unknownZones.get(audit.guildId) ?? new Set<string>();
        zones.add(report.zoneName);
        unknownZones.set(audit.guildId, zones);
        continue;
      }

      const key = `${audit.guildId}|${classification.expansion}|${classification.tier}`;
      const summary =
        coverage.get(key) ??
        ({
          guildId: audit.guildId,
          expansion: classification.expansion,
          tier: classification.tier,
          zones: new Set<string>(),
          reportCodes: new Set<string>(),
          killCount: 0,
          firstDate: null,
          lastDate: null,
          exampleReportCode: null,
        } satisfies CoverageSummary);

      coverage.set(key, summary);
      summary.zones.add(classification.zoneName);
      summary.reportCodes.add(report.code);
      summary.killCount += report.fights.filter((fight) => fight.kill).length;
      summary.exampleReportCode ??= report.code;
      updateDateRange(summary, report);
    }
  }

  return { coverage: [...coverage.values()], unknownZones };
}

function bestSourceForTier(coverage: CoverageSummary[], expansion: string, tier: string) {
  return coverage
    .filter((summary) => summary.expansion === expansion && summary.tier === tier)
    .sort(
      (a, b) =>
        b.zones.size - a.zones.size ||
        b.reportCodes.size - a.reportCodes.size ||
        b.killCount - a.killCount ||
        a.guildId - b.guildId,
    )[0];
}

function buildRecommendedSources(coverage: CoverageSummary[], audits: GuildAudit[]) {
  const grouped = new Map<number, { expansions: Set<string>; tiers: Set<string> }>();

  for (const summary of coverage) {
    const recommended = bestSourceForTier(coverage, summary.expansion, summary.tier);

    if (recommended?.guildId !== summary.guildId) {
      continue;
    }

    const group = grouped.get(summary.guildId) ?? { expansions: new Set<string>(), tiers: new Set<string>() };
    grouped.set(summary.guildId, group);
    group.expansions.add(slugify(summary.expansion));
    group.tiers.add(slugify(summary.tier));
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([guildId, group]) => {
      const metadata = audits.find((audit) => audit.guildId === guildId)?.metadata;

      return {
        ...(guildId > 0 ? { guildId } : {}),
        guildName: metadata?.name ?? null,
        serverSlug: metadata?.serverSlug || null,
        region: metadata?.region || "US",
        label: metadata?.name && metadata.serverName ? `${metadata.name} - ${metadata.serverName}` : `Guild ${guildId}`,
        expansions: [...group.expansions].sort((a, b) => a.localeCompare(b)),
        tiers: [...group.tiers].sort((a, b) => a.localeCompare(b)),
      };
    });
}

function slugify(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function dateRange(summary: CoverageSummary) {
  return `${formatDate(summary.firstDate)} to ${formatDate(summary.lastDate)}`;
}

function reportUrl(code: string | null) {
  return code ? `${reportUrlBase}/${code}` : "";
}

function formatMarkdownTable(headers: string[], rows: string[][]) {
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(md).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function getGuildSummaryRows(audits: GuildAudit[], coverage: CoverageSummary[]) {
  return audits.map((audit) => {
    const guildCoverage = coverage.filter((summary) => summary.guildId === audit.guildId);
    const dates = audit.reports.flatMap((report) => [report.startTime, report.endTime]).filter((date): date is string => Boolean(date)).sort();
    const zones = new Set<string>();
    for (const report of audit.reports) {
      const classification = classifyReport(report);
      zones.add(classification?.zoneName ?? report.zoneName);
    }

    return [
      auditSourceLabel(audit.guildId),
      audit.metadata?.name ?? "Unknown",
      audit.metadata?.serverName || audit.metadata?.serverSlug || "Unknown",
      audit.metadata?.region || "Unknown",
      formatDate(dates[0] ?? null),
      formatDate(dates.at(-1) ?? null),
      mdList(guildCoverage.map((summary) => summary.expansion)),
      String(audit.reports.length),
      mdList(zones),
    ];
  });
}

function getExpansionCoverageRows(coverage: CoverageSummary[]) {
  const rows: string[][] = [];

  for (const [expansion, tiers] of plannedCoverage.entries()) {
    for (const tier of tiers) {
      const bestSource = bestSourceForTier(coverage, expansion, tier);

      rows.push([
        expansion,
        tier,
        bestSource ? mdList(bestSource.zones) : "None found",
        bestSource ? auditSourceLabel(bestSource.guildId) : "None found",
        bestSource ? dateRange(bestSource) : "No reports found",
        bestSource ? `${bestSource.reportCodes.size} reports, ${bestSource.killCount} kills` : "Needs another guild ID or wider report history",
      ]);
    }
  }

  return rows;
}

function getPerGuildZoneSections(audits: GuildAudit[], coverage: CoverageSummary[]) {
  return audits
    .map((audit) => {
      const rows = coverage
        .filter((summary) => summary.guildId === audit.guildId)
        .sort(
          (a, b) =>
            a.expansion.localeCompare(b.expansion) ||
            a.tier.localeCompare(b.tier) ||
            mdList(a.zones).localeCompare(mdList(b.zones)),
        )
        .map((summary) => [
          summary.expansion,
          summary.tier,
          mdList(summary.zones),
          formatDate(summary.firstDate),
          formatDate(summary.lastDate),
          String(summary.reportCodes.size),
          String(summary.killCount),
          reportUrl(summary.exampleReportCode),
        ]);

      return [
        `### ${auditSourceLabel(audit.guildId)}`,
        audit.error ? `Error: ${audit.error}` : "",
        rows.length > 0
          ? formatMarkdownTable(
              ["Expansion", "Tier/phase", "Zones found", "First report", "Last report", "Reports", "Kills", "Example report"],
              rows,
            )
          : "No classified progression zones found.",
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");
}

function getGaps(coverage: CoverageSummary[]) {
  const gaps: string[] = [];

  for (const [expansion, tiers] of plannedCoverage.entries()) {
    for (const tier of tiers) {
      if (!bestSourceForTier(coverage, expansion, tier)) {
        gaps.push(`- ${expansion}: ${tier}`);
      }
    }
  }

  return gaps.length > 0 ? gaps.join("\n") : "No planned gaps found in the audited guild IDs.";
}

function getUnknownZoneNotes(unknownZones: Map<number, Set<string>>) {
  const lines = [...unknownZones.entries()]
    .filter(([, zones]) => zones.size > 0)
    .sort(([a], [b]) => a - b)
    .map(([guildId, zones]) => `- ${auditSourceLabel(guildId)}: ${mdList(zones)}`);

  return lines.length > 0 ? lines.join("\n") : "No unclassified zones found.";
}

function buildSkippedReport(reason: string) {
  const summaryRows = [
    [currentGuild.label, currentGuild.guildName, currentGuild.serverName, currentGuild.region, "Not run", "Not run", "Unknown", "0", "None"],
    ...guildIds.map((guildId) => [String(guildId), "Unknown", "Unknown", "Unknown", "Not run", "Not run", "Unknown", "0", "None"]),
  ];

  return [
    "# Warcraft Logs Guild History Audit",
    "",
    "Status: Not run.",
    "",
    reason,
    "",
    `Configured guild IDs: ${guildIds.join(", ")}`,
    `Current guild source: ${currentGuild.label} (${currentGuild.guildName} on ${currentGuild.serverSlug}, ${currentGuild.region})`,
    "",
    "## Summary by Guild ID",
    "",
    formatMarkdownTable(
      ["Guild ID", "Guild name", "Server/realm", "Region", "Earliest report", "Latest report", "Expansions found", "Report count", "Zones found"],
      summaryRows,
    ),
    "",
    "## Recommended WCL_GUILD_SOURCES_JSON",
    "",
    "No source mapping can be recommended until the audit is run with Warcraft Logs credentials.",
    "",
    "```json",
    "[]",
    "```",
    "",
    "## Gaps",
    "",
    "Audit not run. Run with Warcraft Logs credentials to identify expansion and tier gaps.",
    "",
    "Run this command in an environment with WCL_CLIENT_ID and WCL_CLIENT_SECRET:",
    "",
    "```bash",
    "npm run audit:wcl-guild-history",
    "```",
    "",
  ].join("\n");
}

function buildAuditReport(audits: GuildAudit[]) {
  const { coverage, unknownZones } = buildCoverage(audits);
  const recommendedSources = buildRecommendedSources(coverage, audits);

  return [
    "# Warcraft Logs Guild History Audit",
    "",
    "This audit queries Warcraft Logs API v2 Classic server-side only. It uses guild IDs, report metadata, zones, and fight summaries. It does not query events, casts, or player rankings.",
    "",
    `Configured guild IDs: ${guildIds.join(", ")}`,
    `Current guild source: ${currentGuild.label} (${currentGuild.guildName} on ${currentGuild.serverSlug}, ${currentGuild.region})`,
    `Report limit: ${reportLimit}`,
    `Report pages: ${reportPages}`,
    "",
    "## Summary by Guild ID",
    "",
    formatMarkdownTable(
      ["Guild ID", "Guild name", "Server/realm", "Region", "Earliest report", "Latest report", "Expansions found", "Report count", "Zones found"],
      getGuildSummaryRows(audits, coverage),
    ),
    "",
    "## Expansion Coverage",
    "",
    formatMarkdownTable(
      ["Expansion", "Tier/phase", "Zones found", "Best guild source", "Date range", "Notes/gaps"],
      getExpansionCoverageRows(coverage),
    ),
    "",
    "## Per-Guild Zone Coverage",
    "",
    getPerGuildZoneSections(audits, coverage),
    "",
    "## Recommended WCL_GUILD_SOURCES_JSON",
    "",
    "Only tiers and expansions with evidence in this audit are included.",
    "",
    "```json",
    JSON.stringify(recommendedSources, null, 2),
    "```",
    "",
    "## Gaps",
    "",
    getGaps(coverage),
    "",
    "## Unclassified Zones",
    "",
    getUnknownZoneNotes(unknownZones),
    "",
  ].join("\n");
}

async function writeAuditReport(markdown: string) {
  const docsDir = path.join(root, "docs");
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, "wcl-guild-history-audit.md"), markdown, "utf8");
}

async function auditReportExists() {
  try {
    await fs.access(path.join(root, "docs", "wcl-guild-history-audit.md"));
    return true;
  } catch {
    return false;
  }
}

async function runAudit() {
  const accessToken = await requestAccessToken();

  if (!accessToken) {
    console.log("Skipping Warcraft Logs guild history audit: missing credentials.");
    if (await auditReportExists()) {
      console.log("Preserving existing docs/wcl-guild-history-audit.md.");
    } else {
      await writeAuditReport(
        buildSkippedReport("WCL_CLIENT_ID and WCL_CLIENT_SECRET were not available in this environment. No Warcraft Logs API requests were made."),
      );
    }
    return;
  }

  const audits: GuildAudit[] = [];

  console.log(`Auditing current Warcraft Logs guild source: ${currentGuild.label}`);
  try {
    const metadata: GuildMetadata = {
      id: currentGuild.auditId,
      name: currentGuild.guildName,
      serverName: currentGuild.serverName,
      serverSlug: currentGuild.serverSlug,
      region: currentGuild.region,
    };
    const reports = await fetchCurrentGuildReports(accessToken);
    audits.push({ guildId: currentGuild.auditId, metadata, reports, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${currentGuild.label} audit failed: ${message}`);
    audits.push({ guildId: currentGuild.auditId, metadata: null, reports: [], error: message });
  }

  for (const guildId of guildIds) {
    console.log(`Auditing Warcraft Logs guild ${guildId}`);

    try {
      const [metadata, reports] = await Promise.all([
        fetchGuildMetadata(accessToken, guildId),
        fetchGuildReports(accessToken, guildId),
      ]);
      audits.push({ guildId, metadata, reports, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Guild ${guildId} audit failed: ${message}`);
      audits.push({ guildId, metadata: null, reports: [], error: message });
    }
  }

  await writeAuditReport(buildAuditReport(audits));
  console.log("Wrote docs/wcl-guild-history-audit.md");
}

await runAudit().catch((error: unknown) => {
  console.error(`Warcraft Logs guild history audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
