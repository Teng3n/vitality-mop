import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type ReportIndex = {
  reports: IndexedReport[];
};

type ProgressionSeed = {
  raids: Array<{
    bosses?: Array<{ name?: string | null; encounterId?: number | null }>;
  }>;
};

type IndexedReport = {
  code: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  sourceLabel: string;
  sourceGuildName: string;
  sourceServerSlug: string;
  zone?: { name?: string | null } | null;
  fights: Array<{ encounterId?: number | null; name?: string | null }>;
};

type ReportDetail = {
  code?: string | null;
  title?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  masterData?: {
    actors?: Array<{
      id?: number | null;
      name?: string | null;
      type?: string | null;
      subType?: string | null;
    }> | null;
  } | null;
  fights?: Array<{
    id?: number | null;
    name?: string | null;
    encounterID?: number | null;
    startTime?: number | null;
    endTime?: number | null;
    friendlyPlayers?: number[] | null;
  }> | null;
};

type AttendanceQuery = {
  reportData?: { report?: ReportDetail | null } | null;
};

type Appearance = {
  expansion: string;
  className: string;
  lastDate: string;
  source: string;
  reportUrl: string;
  reportCode: string;
  reportTitle: string;
  fightId: number;
  encounterName: string;
  timestamp: string;
};

type CharacterAggregate = {
  name: string;
  appearances: Map<string, Appearance>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenEndpoint = "https://www.warcraftlogs.com/oauth/token";
const apiEndpoint = "https://classic.warcraftlogs.com/api/v2/client";
const reportsPath = path.join(root, "src", "data", "wclReports.json");
const progressionPath = path.join(root, "src", "data", "wclProgressionSeed.json");
const charactersPath = path.join(root, "src", "data", "historicalRaiderCharacters.json");
const peoplePath = path.join(root, "src", "data", "historicalRaiders.json");
const rosterPath = path.join(root, "docs", "warcraft-logs-unique-raiders.md");
const ownerAuditPath = path.join(root, "docs", "owner-scoped-raider-audit.json");
const concurrency = Math.max(1, Math.min(Number(process.env.WCL_HISTORY_CONCURRENCY) || 6, 10));
const ownerCharacters = cleanText(process.env.WCL_HISTORY_OWNER_CHARACTERS)
  .split(",")
  .map((name) => cleanText(name))
  .filter(Boolean);
const ownerCharacterKeys = new Set(ownerCharacters.map(characterKey));

const reportAttendanceQuery = `
query HistoricalReportAttendance($code: String!) {
  reportData {
    report(code: $code) {
      code
      title
      startTime
      endTime
      masterData(translate: true) {
        actors {
          id
          name
          type
          subType
        }
      }
      fights(translate: true) {
        id
        name
        encounterID
        startTime
        endTime
        friendlyPlayers
      }
    }
  }
}
`;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function characterKey(value: string) {
  return value.normalize("NFC").toLocaleLowerCase();
}

function encounterKey(value: unknown) {
  return cleanText(value).toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function sourceDisplayName(value: string) {
  return value.replace(" - ", " — ");
}

function getExpansion(date: string) {
  if (date < "2021-06-01") return "Classic";
  if (date < "2022-09-26") return "TBC";
  if (date < "2024-05-20") return "Wrath";
  if (date < "2025-07-21") return "Cataclysm";
  return "MoP";
}

function absoluteFightTime(reportStart: number | null, value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed > 1_000_000_000_000 || reportStart === null) return parsed;
  return reportStart + parsed;
}

function isoDate(value: number | null) {
  return value === null ? null : new Date(value).toISOString();
}

function raidDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isLater(candidate: Appearance, current: Appearance | undefined) {
  return !current || candidate.timestamp > current.timestamp;
}

async function getAccessToken() {
  const clientId = cleanText(process.env.WCL_CLIENT_ID);
  const clientSecret = cleanText(process.env.WCL_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error("WCL_CLIENT_ID and WCL_CLIENT_SECRET are required.");

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Warcraft Logs OAuth failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  const token = cleanText((JSON.parse(body) as { access_token?: string }).access_token);
  if (!token) throw new Error("Warcraft Logs OAuth returned no access token.");
  return token;
}

async function fetchReport(accessToken: string, code: string, attempt = 1): Promise<ReportDetail | null> {
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: reportAttendanceQuery, variables: { code } }),
  });
  const body = await response.text();

  if ((!response.ok || response.status === 429) && attempt < 8) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(60_000, 5_000 * 2 ** (attempt - 1));
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchReport(accessToken, code, attempt + 1);
  }
  if (!response.ok) throw new Error(`${code}: HTTP ${response.status}: ${body.slice(0, 300)}`);

  const parsed = JSON.parse(body) as GraphQlResponse<AttendanceQuery>;
  if (parsed.errors?.length) {
    if (attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, 5_000 * 2 ** (attempt - 1))));
      return fetchReport(accessToken, code, attempt + 1);
    }
    throw new Error(`${code}: ${parsed.errors.map((error) => error.message ?? "Unknown GraphQL error").join("; ")}`);
  }
  return parsed.data?.reportData?.report ?? null;
}

const [reportIndex, progressionSeed] = await Promise.all([
  fs.readFile(reportsPath, "utf8").then((source) => JSON.parse(source) as ReportIndex),
  fs.readFile(progressionPath, "utf8").then((source) => JSON.parse(source) as ProgressionSeed),
]);
const raidEncounterNames = new Set(
  progressionSeed.raids.flatMap((raid) => raid.bosses ?? []).map((boss) => encounterKey(boss.name)),
);
for (const name of [
  "High Priestess Jeklik", "High Priest Venoxis", "High Priestess Mar'li", "Bloodlord Mandokir",
  "Edge of Madness", "High Priest Thekal", "High Priestess Arlokk", "Jin'do the Hexxer", "Hakkar", "Gahz'ranka",
  "Archavon the Stone Watcher", "Emalon the Storm Watcher", "Koralon the Flame Watcher", "Toravon the Ice Watcher",
  "Argaloth", "Occu'thar", "Alizabal", "Blood Council", "Queen Lana'thel",
  "Akil'zon", "Nalorakk", "Jan'alai", "Halazzi", "Hex Lord Malacrass", "Zul'jin",
]) {
  raidEncounterNames.add(encounterKey(name));
}

function isRaidEncounter(report: IndexedReport, fightName: unknown) {
  const key = encounterKey(fightName);
  if (raidEncounterNames.has(key)) return true;
  if (key !== "daakara") return false;
  return encounterKey(report.zone?.name).includes("zulaman") || encounterKey(report.title).includes("zulaman");
}

const reports = reportIndex.reports.filter(
  (report) => report.code && report.fights?.some((fight) => isRaidEncounter(report, fight.name)),
);
const accessToken = await getAccessToken();
const characters = new Map<string, CharacterAggregate>();
const sameFightCharacters = new Map<string, CharacterAggregate>();
const failedReports: string[] = [];
const qualifyingReportCodes = new Set<string>();
const qualifyingReportFightKeys = new Set<string>();
const qualifyingSameFightKeys = new Set<string>();
const observedOwnerCharacters = new Set<string>();
let cursor = 0;
let completed = 0;

function recordAppearance(target: Map<string, CharacterAggregate>, name: string, appearance: Appearance) {
  const key = characterKey(name);
  const aggregate = target.get(key) ?? { name, appearances: new Map<string, Appearance>() };
  if (isLater(appearance, aggregate.appearances.get(appearance.expansion))) {
    aggregate.name = name;
    aggregate.appearances.set(appearance.expansion, appearance);
  }
  target.set(key, aggregate);
}

function mergeCharacters(target: Map<string, CharacterAggregate>, source: Map<string, CharacterAggregate>) {
  for (const aggregate of source.values()) {
    for (const appearance of aggregate.appearances.values()) {
      recordAppearance(target, aggregate.name, appearance);
    }
  }
}

async function processReport(indexed: IndexedReport) {
  const report = await fetchReport(accessToken, indexed.code);
  if (!report) return;

  const reportStart = Number.isFinite(Number(report.startTime)) ? Number(report.startTime) : null;
  const actors = new Map(
    (report.masterData?.actors ?? [])
      .filter((actor) => actor.id && actor.name && (!actor.type || actor.type.toLocaleLowerCase() === "player"))
      .map((actor) => [Number(actor.id), actor]),
  );
  const reportCharacters = new Map<string, CharacterAggregate>();
  const reportFightKeys = new Set<string>();
  const reportOwnerCharacters = new Set<string>();

  for (const fight of report.fights ?? []) {
    const fightId = Number(fight.id);
    if (!Number.isFinite(fightId) || !isRaidEncounter(indexed, fight.name) || !fight.friendlyPlayers?.length) continue;

    const timestamp =
      isoDate(absoluteFightTime(reportStart, fight.endTime)) ??
      isoDate(absoluteFightTime(reportStart, fight.startTime)) ??
      indexed.endTime ??
      indexed.startTime;
    if (!timestamp) continue;

    const lastDate = raidDate(timestamp);
    const expansion = getExpansion(lastDate);
    const source = sourceDisplayName(indexed.sourceLabel);
    const reportCode = cleanText(report.code) || indexed.code;
    const reportTitle = cleanText(report.title) || indexed.title || reportCode;
    const fightKey = `${reportCode}:${fightId}`;
    const fightCharacters: Array<{ name: string; appearance: Appearance }> = [];
    reportFightKeys.add(fightKey);

    for (const actorId of fight.friendlyPlayers) {
      const actor = actors.get(Number(actorId));
      const name = cleanText(actor?.name);
      if (!name) continue;

      const appearance: Appearance = {
        expansion,
        className: cleanText(actor?.subType) || "Unknown",
        lastDate,
        source,
        reportUrl: `https://classic.warcraftlogs.com/reports/${reportCode}#fight=${fightId}&type=summary`,
        reportCode,
        reportTitle,
        fightId,
        encounterName: cleanText(fight.name) || "Raid encounter",
        timestamp,
      };
      fightCharacters.push({ name, appearance });
      recordAppearance(reportCharacters, name, appearance);
    }

    const ownersInFight = fightCharacters.filter(({ name }) => ownerCharacterKeys.has(characterKey(name)));
    if (ownersInFight.length > 0) {
      qualifyingSameFightKeys.add(fightKey);
      for (const { name } of ownersInFight) {
        reportOwnerCharacters.add(name);
        observedOwnerCharacters.add(name);
      }
      for (const { name, appearance } of fightCharacters) {
        recordAppearance(sameFightCharacters, name, appearance);
      }
    }
  }

  if (ownerCharacterKeys.size === 0) {
    mergeCharacters(characters, reportCharacters);
    return;
  }

  if (reportOwnerCharacters.size > 0) {
    qualifyingReportCodes.add(indexed.code);
    for (const fightKey of reportFightKeys) qualifyingReportFightKeys.add(fightKey);
    mergeCharacters(characters, reportCharacters);
  }
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= reports.length) return;
    const report = reports[index];
    try {
      await processReport(report);
    } catch (error) {
      failedReports.push(report.code);
      console.error(`Failed ${report.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
    completed += 1;
    if (completed % 50 === 0 || completed === reports.length) {
      console.log(`Processed ${completed}/${reports.length} raid reports.`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

function buildRecords(source: Map<string, CharacterAggregate>) {
  return [...source.values()]
  .map((character) => {
    const appearances = [...character.appearances.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const latest = appearances[0];
    return {
      name: character.name,
      className: latest.className,
      lastDate: latest.lastDate,
      source: latest.source,
      reportUrl: latest.reportUrl,
      reportCode: latest.reportCode,
      reportTitle: latest.reportTitle,
      fightId: latest.fightId,
      encounterName: latest.encounterName,
      appearances: appearances.map(({ timestamp: _timestamp, ...appearance }) => appearance),
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));
}

const records = buildRecords(characters);

if (records.length === 0) throw new Error("No verified boss-fight participants were found.");
if (failedReports.length > 0) {
  throw new Error(`Could not verify ${failedReports.length} report(s): ${failedReports.join(", ")}`);
}

if (ownerCharacterKeys.size > 0) {
  const people = JSON.parse(await fs.readFile(peoplePath, "utf8")) as Array<{ name: string; characters: string[] }>;
  const personByCharacter = new Map(
    people.flatMap((person) => person.characters.map((character) => [characterKey(character), person.name] as const)),
  );
  const summarize = (scopedRecords: ReturnType<typeof buildRecords>) => {
    const personNames = new Set(scopedRecords.map((record) => personByCharacter.get(characterKey(record.name)) ?? record.name));
    const expansions = ["Classic", "TBC", "Wrath", "Cataclysm", "MoP"].map((expansion) => {
      const expansionRecords = scopedRecords.filter((record) => record.appearances.some((appearance) => appearance.expansion === expansion));
      return {
        expansion,
        characters: expansionRecords.length,
        people: new Set(expansionRecords.map((record) => personByCharacter.get(characterKey(record.name)) ?? record.name)).size,
      };
    });
    return { characters: scopedRecords.length, people: personNames.size, expansions };
  };
  const sameFightRecords = buildRecords(sameFightCharacters);
  const sameFightCharacterKeys = new Set(sameFightRecords.map((record) => characterKey(record.name)));
  const reportOnlyCharacters = records
    .filter((record) => !sameFightCharacterKeys.has(characterKey(record.name)))
    .map((record) => ({
      name: record.name,
      person: personByCharacter.get(characterKey(record.name)) ?? record.name,
      className: record.className,
      lastDate: record.lastDate,
      source: record.source,
      reportUrl: record.reportUrl,
      reportTitle: record.reportTitle,
      encounterName: record.encounterName,
      expansions: record.appearances.map((appearance) => appearance.expansion),
    }));
  const summary = {
    generatedAt: new Date().toISOString(),
    ownerCharactersRequested: ownerCharacters,
    ownerCharactersObserved: [...observedOwnerCharacters].sort((left, right) => left.localeCompare(right)),
    reportScoped: {
      reports: qualifyingReportCodes.size,
      raidBossFights: qualifyingReportFightKeys.size,
      ...summarize(records),
    },
    sameFightScoped: {
      raidBossFights: qualifyingSameFightKeys.size,
      ...summarize(sameFightRecords),
    },
    reportOnlyCharacters,
  };
  await fs.writeFile(ownerAuditPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`OWNER_SCOPE_SUMMARY ${JSON.stringify(summary)}`);
  console.log(`Wrote ${path.relative(root, ownerAuditPath)}`);
  process.exit(0);
}

const sourceCounts = new Map<string, Set<string>>();
for (const record of records) {
  for (const appearance of record.appearances) {
    sourceCounts.set(appearance.source, (sourceCounts.get(appearance.source) ?? new Set<string>()).add(characterKey(record.name)));
  }
}

const rosterLines = [
  "# Warcraft Logs Unique Raider Characters",
  "",
  `Generated from verified boss-fight attendance on ${new Date().toISOString().slice(0, 10)}.`,
  "",
  ...[...sourceCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, names]) => `- ${source}: ${names.size} character names`),
  `- Combined unique character names: ${records.length}`,
  "",
  "Definition: a named player character included in `friendlyPlayers` for at least one uploaded raid boss encounter. Merely appearing in a report actor list or guild roster is not enough. Names are deduplicated case-insensitively across all guild identities.",
  "",
  "## Alphabetical list",
  "",
  ...records.map((record, index) => `${index + 1}. ${record.name}`),
  "",
];

await Promise.all([
  fs.writeFile(charactersPath, `${JSON.stringify(records, null, 2)}\n`, "utf8"),
  fs.writeFile(rosterPath, rosterLines.join("\n"), "utf8"),
]);

console.log(`Verified characters: ${records.length}`);
console.log(`Wrote ${path.relative(root, charactersPath)}`);
console.log(`Wrote ${path.relative(root, rosterPath)}`);
