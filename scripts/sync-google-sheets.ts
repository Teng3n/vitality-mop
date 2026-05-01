import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { google } from "googleapis";
import { cleanPlayerName, getPlayerSlug } from "../src/lib/playerNames";

type SheetRow = string[];
type ColumnSpec = {
  key: string;
  aliases: string[];
  required?: boolean;
};
type ColumnIndexes = Record<string, number | undefined>;

interface RosterRow {
  character: string;
  class: string;
  spec: string;
  role: string;
}

interface RaidDate {
  label: string;
  isoDate: string;
}

interface CalendarSummary {
  label: string;
  values: Record<string, string>;
}

interface CalendarPlayer {
  rank: number;
  name: string;
  bis: number;
  major: number;
  minor: number;
  total: number;
  bonusRolls: number;
  offspec: number;
  mia: number;
  out: number;
  late: number;
  bench: number;
  schedule: Record<string, string>;
}

interface CalendarData {
  dates: string[];
  raidDates: RaidDate[];
  summary: CalendarSummary[];
  players: CalendarPlayer[];
}

interface LootHistoryRow {
  date: string;
  player: string;
  realm: string;
  characterRealm: string;
  item: string;
  boss: string;
  instance: string;
  type: string;
}

interface LootSummaryRow {
  player: string;
  realm: string;
  characterRealm: string;
  bis: number;
  major: number;
  minor: number;
  offspec: number;
  bonusRolls: number;
  total: number;
}

interface BenchRow {
  player: string;
  totalBenchCount: number;
  lastBenched: string;
  notes: string;
}

interface BenchRulesData {
  neverBenchPlayers: string[];
  avoidBenchingTogether: [string, string][];
  minimumAvailableByRole: Record<string, number>;
  minimumAvailableByClass: Record<string, number>;
  requireAtLeastOneAvailablePerClass: boolean;
  minimumAvailablePerClass: number;
  planningWindowWeeks: number;
  scoring: {
    lowBenchCountWeight: number;
    notRecentlyBenchedWeight: number;
    backToBackBenchPenalty: number;
    recentlyUnavailablePenalty: number;
    adjacentUnavailablePenalty: number;
  };
  source: "sheet" | "fallback";
}

type BenchRuleParseResult = {
  rules: BenchRulesData;
  importedRuleCount: number;
  source: "sheet" | "fallback";
};

type PlayerInfo = {
  player: string;
  realm: string;
  characterRealm: string;
};

type ServiceAccountCredentials = {
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const warnings = new Set<string>();
const errors: string[] = [];

loadEnv({ path: path.join(root, ".env.local"), override: false });
loadEnv({ path: path.join(root, ".env"), override: false });

const requiredEnv = ["GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"] as const;
const env = Object.fromEntries(requiredEnv.map((key) => [key, cleanText(process.env[key])])) as Record<
  (typeof requiredEnv)[number],
  string
>;
const ranges = {
  calendar: cleanText(process.env.CALENDAR_RANGE) || "Calendar!A:ZZ",
  loot: cleanText(process.env.LOOT_RANGE) || "History!A:Z",
  benchRules: cleanText(process.env.BENCH_RULES_RANGE) || "Bench Rules!A:I",
};

for (const key of requiredEnv) {
  if (!env[key]) {
    errors.push(`Missing required environment variable: ${key}`);
  }
}

const calendarRosterColumns: ColumnSpec[] = [
  { key: "rank", aliases: ["rank", "number", "no"], required: false },
  { key: "name", aliases: ["name", "player", "character"], required: true },
  { key: "class", aliases: ["class"], required: true },
  { key: "spec", aliases: ["spec", "specialization"], required: true },
  { key: "role", aliases: ["role"], required: false },
];

const lootColumns: ColumnSpec[] = [
  { key: "player", aliases: ["player", "character", "name"], required: true },
  { key: "date", aliases: ["date", "received", "awarded"], required: true },
  { key: "item", aliases: ["item", "itemname"], required: true },
  { key: "response", aliases: ["response", "type", "awardtype"], required: true },
  { key: "instance", aliases: ["instance", "raid"], required: true },
  { key: "boss", aliases: ["boss", "encounter"], required: true },
  { key: "time", aliases: ["time", "timestamp"], required: false },
];

const benchRuleColumns: ColumnSpec[] = [
  { key: "enabled", aliases: ["enabled"], required: true },
  { key: "ruleType", aliases: ["rule type", "ruletype", "type"], required: true },
  { key: "player1", aliases: ["player 1", "player1", "player one"], required: false },
  { key: "player2", aliases: ["player 2", "player2", "player two"], required: false },
  { key: "class", aliases: ["class"], required: false },
  { key: "role", aliases: ["role"], required: false },
  { key: "minAvailable", aliases: ["min available", "minavailable", "minimum available"], required: false },
  { key: "weight", aliases: ["weight"], required: false },
  { key: "notes", aliases: ["notes"], required: false },
];

const monthNumbers = new Map([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

const statusAliases = new Map([
  ["bench", "Bench"],
  ["benched", "Bench"],
  ["out", "Out"],
  ["absent", "Out"],
  ["late", "Late"],
  ["tardy", "Late"],
  ["mia", "MIA"],
  ["missinginaction", "MIA"],
  ["trial", "Trial"],
  ["available", "Available"],
  ["avail", "Available"],
  ["unknown", "Unknown"],
]);

const enabledValues = new Set(["true", "yes", "y", "1"]);
const defaultPlanningWindowWeeks = 8;
const defaultScoring = {
  lowBenchCountWeight: 10,
  notRecentlyBenchedWeight: 6,
  backToBackBenchPenalty: -8,
  recentlyUnavailablePenalty: -5,
  adjacentUnavailablePenalty: -10,
};
const fallbackHardRules = {
  neverBenchPlayers: ["tengen", "karkan"],
  avoidBenchingTogether: [["drchicken", "cardinalcrzy"]] as [string, string][],
  minimumAvailableByRole: {
    Healer: 5,
  },
  minimumAvailableByClass: {
    "Death Knight": 2,
    Warrior: 2,
    Paladin: 2,
  },
  requireAtLeastOneAvailablePerClass: true,
  minimumAvailablePerClass: 1,
};
const fallbackBenchRules: BenchRulesData = {
  ...fallbackHardRules,
  planningWindowWeeks: defaultPlanningWindowWeeks,
  scoring: defaultScoring,
  source: "fallback",
};
const classNamesByKey = new Map([
  ["deathknight", "Death Knight"],
  ["druid", "Druid"],
  ["hunter", "Hunter"],
  ["mage", "Mage"],
  ["monk", "Monk"],
  ["paladin", "Paladin"],
  ["priest", "Priest"],
  ["rogue", "Rogue"],
  ["shaman", "Shaman"],
  ["warlock", "Warlock"],
  ["warrior", "Warrior"],
]);
const roleNamesByKey = new Map([
  ["tank", "Tank"],
  ["healer", "Healer"],
  ["meleedps", "Melee DPS"],
  ["melee", "Melee DPS"],
  ["rangeddps", "Ranged DPS"],
  ["ranged", "Ranged DPS"],
]);

const tankSpecs = new Set(["deathknight:blood", "druid:guardian", "monk:brewmaster", "paladin:protection", "warrior:protection"]);
const healerSpecs = new Set([
  "druid:restoration",
  "monk:mistweaver",
  "paladin:holy",
  "priest:discipline",
  "priest:holy",
  "shaman:restoration",
]);
const meleeSpecs = new Set([
  "deathknight:frost",
  "deathknight:unholy",
  "druid:feral",
  "monk:windwalker",
  "paladin:retribution",
  "rogue:assassination",
  "rogue:combat",
  "rogue:subtlety",
  "shaman:enhancement",
  "warrior:arms",
  "warrior:fury",
]);
const rangedSpecs = new Set([
  "druid:balance",
  "hunter:beastmastery",
  "hunter:marksmanship",
  "hunter:survival",
  "mage:arcane",
  "mage:fire",
  "mage:frost",
  "priest:shadow",
  "shaman:elemental",
  "warlock:affliction",
  "warlock:demonology",
  "warlock:destruction",
]);
const rangedClassFallbacks = new Set(["hunter", "mage", "warlock"]);
const meleeClassFallbacks = new Set(["deathknight", "rogue", "warrior"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeColumn(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function asNumber(value: unknown) {
  const parsed = Number(cleanText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asOptionalNumber(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRoleKey(value: string) {
  return normalizeColumn(value).replace(/^deathknight$/, "deathknight");
}

function normalizeClassName(value: string) {
  const text = cleanText(value);
  return classNamesByKey.get(normalizeColumn(text)) ?? text;
}

function normalizeRoleName(value: string) {
  const text = cleanText(value);
  return roleNamesByKey.get(normalizeColumn(text)) ?? text;
}

function normalizeRuleType(value: string) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}

function normalizeA1Range(range: string) {
  const bangIndex = range.indexOf("!");

  if (bangIndex < 0) {
    return range;
  }

  const sheetName = range.slice(0, bangIndex);
  const cells = range.slice(bangIndex + 1);

  if (!sheetName.includes(" ") || sheetName.startsWith("'")) {
    return range;
  }

  return `'${sheetName.replaceAll("'", "''")}'!${cells}`;
}

function deriveRole(className: string, spec: string, playerName: string) {
  const roleKey = `${normalizeRoleKey(className)}:${normalizeRoleKey(spec)}`;

  if (tankSpecs.has(roleKey)) {
    return "Tank";
  }

  if (healerSpecs.has(roleKey)) {
    return "Healer";
  }

  if (meleeSpecs.has(roleKey)) {
    return "Melee DPS";
  }

  if (rangedSpecs.has(roleKey)) {
    return "Ranged DPS";
  }

  const classKey = normalizeRoleKey(className);

  if (rangedClassFallbacks.has(classKey)) {
    warn(`Calendar player "${playerName}" has unmapped spec "${spec}" for class "${className}"; defaulting role to Ranged DPS.`);
    return "Ranged DPS";
  }

  if (meleeClassFallbacks.has(classKey)) {
    warn(`Calendar player "${playerName}" has unmapped spec "${spec}" for class "${className}"; defaulting role to Melee DPS.`);
    return "Melee DPS";
  }

  warn(`Calendar player "${playerName}" has unmapped class/spec "${className} ${spec}"; defaulting role to Ranged DPS.`);
  return "Ranged DPS";
}

function warn(message: string) {
  warnings.add(message);
}

function failIfErrors() {
  if (errors.length === 0) {
    return;
  }

  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }

  process.exit(1);
}

function normalizeSheetRows(values: unknown[][] | null | undefined) {
  return (values ?? []).map((row) => row.map(cleanText));
}

function buildColumnIndexes(headers: SheetRow, specs: ColumnSpec[]) {
  const normalizedHeaders = headers.map(normalizeColumn);
  const indexes: ColumnIndexes = {};

  for (const spec of specs) {
    const aliases = spec.aliases.map(normalizeColumn);
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    indexes[spec.key] = index >= 0 ? index : undefined;
  }

  return indexes;
}

function findHeaderRow(rows: SheetRow[], specs: ColumnSpec[], label: string) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const indexes = buildColumnIndexes(row, specs);
    const missing = specs.filter((spec) => spec.required && indexes[spec.key] === undefined);

    if (missing.length === 0) {
      return { index, indexes };
    }
  }

  const required = specs.filter((spec) => spec.required).map((spec) => spec.aliases[0]);
  errors.push(`${label} sheet missing required columns: ${required.join(", ")}`);
  return { index: -1, indexes: {} as ColumnIndexes };
}

function getCell(row: SheetRow, index: number | undefined) {
  return index === undefined ? "" : cleanText(row[index]);
}

function sortByName<T>(rows: T[], getName: (row: T) => string) {
  return [...rows].sort((a, b) => getName(a).localeCompare(getName(b), undefined, { sensitivity: "base" }));
}

function getGoogleApiErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "number" || typeof code === "string" ? String(code) : "";
}

function loadServiceAccountCredentials() {
  try {
    const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountCredentials;
    credentials.private_key = cleanText(credentials.private_key).replace(/\\n/g, "\n");

    if (!cleanText(credentials.client_email) || !cleanText(credentials.private_key)) {
      errors.push("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
    }

    failIfErrors();
    return credentials;
  } catch {
    errors.push("GOOGLE_SERVICE_ACCOUNT_JSON must be valid service account JSON.");
    failIfErrors();
    throw new Error("Invalid service account credentials.");
  }
}

async function createSheetsClient() {
  const credentials = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

async function fetchSheetRows(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  range: string,
  label: string,
) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: normalizeA1Range(range),
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    return normalizeSheetRows(response.data.values);
  } catch (error: unknown) {
    const code = getGoogleApiErrorCode(error);
    const codeText = code ? ` HTTP ${code}.` : "";
    throw new Error(
      `${label} range could not be read.${codeText} Confirm the spreadsheet is shared with the service account and the configured range exists.`,
    );
  }
}

async function fetchOptionalSheetRows(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  range: string,
  label: string,
) {
  try {
    return await fetchSheetRows(sheets, spreadsheetId, range, label);
  } catch (error: unknown) {
    warn(`${label} range could not be read; using fallback bench rules. ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function findCalendarHeaderRow(rows: SheetRow[]) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const indexes = buildColumnIndexes(row, calendarRosterColumns);
    const rankIndex = row.findIndex((value) => cleanText(value) === "#");

    if (rankIndex >= 0) {
      indexes.rank = rankIndex;
    }

    const missing = calendarRosterColumns.filter((spec) => spec.required && indexes[spec.key] === undefined);

    if (missing.length === 0) {
      return { index, indexes, row };
    }
  }

  errors.push("Calendar sheet missing required roster columns: Name, Class, Spec");
  return { index: -1, indexes: {} as ColumnIndexes, row: [] as SheetRow };
}

function getCalendarDateColumns(headers: SheetRow, indexes: ColumnIndexes) {
  const staticIndexes = Object.values(indexes).filter((index): index is number => typeof index === "number");
  const firstDateIndex = Math.max(...staticIndexes) + 1;
  const dateColumns = headers
    .map((label, index) => ({ index, label: cleanText(label), parsedDate: parseRaidDateLabel(label) }))
    .filter((column) => column.index >= firstDateIndex && column.label && column.parsedDate);

  if (dateColumns.length === 0) {
    errors.push(
      "Calendar sheet has no valid raid date columns. Add date headers after Name/Class/Spec like May 03, May 04, or 2026-05-03.",
    );
    failIfErrors();
  }

  return dateColumns.map(({ index, label }) => ({ index, label }));
}

function parseExplicitIsoDate(label: string) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(label);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseRaidDateLabel(label: string) {
  const text = cleanText(label);
  const iso = parseExplicitIsoDate(text);

  if (iso) {
    return iso;
  }

  const slashDate = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(text);

  if (slashDate) {
    const [, month, day, rawYear] = slashDate;
    const parsedYear = rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : undefined;

    return {
      year: parsedYear,
      month: Number(month),
      day: Number(day),
    };
  }

  const namedDate = /^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{2}|\d{4}))?$/.exec(text);

  if (namedDate) {
    const [, monthName, day, rawYear] = namedDate;
    const month = monthNumbers.get(monthName.toLowerCase());

    if (month) {
      return {
        year: rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : undefined,
        month,
        day: Number(day),
      };
    }
  }

  return null;
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferRaidDates(labels: string[], existingRaidDates: RaidDate[] = []) {
  const existingByLabel = new Map(existingRaidDates.map((date) => [date.label, date.isoDate]));
  const configuredStartYear = asNumber(process.env.CALENDAR_START_YEAR);
  const parsed = labels.map((label) => {
    const date = parseRaidDateLabel(label);

    if (!date) {
      errors.push(`Calendar date label "${label}" is not recognized.`);
      return { label, month: 1, day: 1, year: undefined as number | undefined };
    }

    return { label, ...date };
  });
  failIfErrors();

  const firstKnownYear =
    parsed[0]?.year ??
    (existingByLabel.get(parsed[0]?.label ?? "") ? Number(existingByLabel.get(parsed[0]?.label ?? "")?.slice(0, 4)) : undefined) ??
    configuredStartYear;

  if (!firstKnownYear) {
    errors.push(
      "Calendar date labels do not include years and no existing calendar data was available. Set CALENDAR_START_YEAR for the first sync.",
    );
    failIfErrors();
  }

  let inferredYear = firstKnownYear;
  let previousMonth = parsed[0]?.month ?? 1;

  return parsed.map((date, index) => {
    const existingIsoDate = existingByLabel.get(date.label);

    if (date.year) {
      inferredYear = date.year;
    } else if (existingIsoDate) {
      inferredYear = Number(existingIsoDate.slice(0, 4));
    } else if (index > 0 && date.month < previousMonth) {
      inferredYear += 1;
    }

    previousMonth = date.month;

    return {
      label: date.label,
      isoDate: existingIsoDate ?? formatIsoDate(date.year ?? inferredYear, date.month, date.day),
    };
  });
}

function normalizeStatus(value: string, context: string) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const normalized = normalizeColumn(text);
  const status = statusAliases.get(normalized);

  if (!status) {
    warn(`${context}: unexpected calendar status "${text}" normalized to Unknown.`);
    return "Unknown";
  }

  if (status === "Available") {
    return "";
  }

  return status;
}

function countStatus(schedule: Record<string, string>, status: string) {
  return Object.values(schedule).filter((value) => value === status).length;
}

function buildCalendarSummary(players: CalendarPlayer[], dates: string[]) {
  const statusLabels = ["MIA", "Out", "Late", "Bench", "Trial", "Unknown"];

  return [
    ...statusLabels.map((label) => ({
      label,
      values: Object.fromEntries(
        dates.map((date) => [date, String(players.filter((player) => player.schedule[date] === label).length)]),
      ),
    })),
    {
      label: "Available",
      values: Object.fromEntries(
        dates.map((date) => [date, String(players.filter((player) => !player.schedule[date]).length)]),
      ),
    },
  ];
}

function parseCalendar(rows: SheetRow[], existingRaidDates: RaidDate[] = []) {
  const header = findCalendarHeaderRow(rows);
  failIfErrors();

  const dateColumns = getCalendarDateColumns(header.row, header.indexes);
  const dates = dateColumns.map((column) => column.label);
  const raidDates = inferRaidDates(dates, existingRaidDates);
  const seenSlugs = new Map<string, string>();
  const roster: RosterRow[] = [];
  const players: CalendarPlayer[] = [];

  rows.slice(header.index + 1).forEach((row, rowOffset) => {
    const rowNumber = header.index + rowOffset + 2;
    const name = cleanPlayerName(getCell(row, header.indexes.name));

    if (!name && row.every((value) => !cleanText(value))) {
      return;
    }

    if (!name) {
      warn(`Calendar row ${rowNumber} is missing a player name and was skipped.`);
      return;
    }

    const slug = getPlayerSlug(name);

    if (seenSlugs.has(slug)) {
      warn(`Duplicate Calendar player "${name}" maps to the same slug as "${seenSlugs.get(slug)}" and was skipped.`);
      return;
    }

    const className = getCell(row, header.indexes.class);
    const spec = getCell(row, header.indexes.spec);

    if (!className || !spec) {
      errors.push(`Calendar row ${rowNumber} for "${name}" is missing class or spec.`);
      return;
    }

    const role = getCell(row, header.indexes.role) || deriveRole(className, spec, name);
    const schedule = Object.fromEntries(
      dateColumns
        .map((column) => {
          const status = normalizeStatus(row[column.index] ?? "", `${name} ${column.label}`);
          return [column.label, status] as const;
        })
        .filter(([, status]) => status),
    );

    seenSlugs.set(slug, name);
    roster.push({
      character: name,
      class: className,
      spec,
      role,
    });
    players.push({
      rank: asNumber(getCell(row, header.indexes.rank)) || rowOffset + 1,
      name,
      bis: 0,
      major: 0,
      minor: 0,
      total: 0,
      bonusRolls: 0,
      offspec: 0,
      mia: countStatus(schedule, "MIA"),
      out: countStatus(schedule, "Out"),
      late: countStatus(schedule, "Late"),
      bench: countStatus(schedule, "Bench"),
      schedule,
    });
  });

  if (players.length === 0) {
    errors.push("Calendar sheet produced no player rows.");
  }

  failIfErrors();

  const sortedPlayers = players.sort(
    (a, b) => a.rank - b.rank || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return {
    roster: sortByName(roster, (row) => row.character),
    calendar: {
      dates,
      raidDates,
      summary: buildCalendarSummary(sortedPlayers, dates),
      players: sortedPlayers,
    },
  };
}

function findOptionalHeaderRow(rows: SheetRow[], specs: ColumnSpec[], label: string) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const indexes = buildColumnIndexes(row, specs);
    const missing = specs.filter((spec) => spec.required && indexes[spec.key] === undefined);

    if (missing.length === 0) {
      return { index, indexes };
    }
  }

  warn(`${label} sheet missing required columns for enabled rules and rule type; using fallback bench rules.`);
  return null;
}

function isEnabledRule(value: string) {
  return enabledValues.has(normalizeColumn(value));
}

function sortedObjectByKey(values: Record<string, number>) {
  return Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
}

function sortRulePairs(pairs: [string, string][]) {
  return pairs
    .map((pair) => [...pair].sort((a, b) => a.localeCompare(b)) as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

function normalizeBenchRules(rules: BenchRulesData): BenchRulesData {
  return {
    neverBenchPlayers: [...new Set(rules.neverBenchPlayers)].sort((a, b) => a.localeCompare(b)),
    avoidBenchingTogether: sortRulePairs(rules.avoidBenchingTogether),
    minimumAvailableByRole: sortedObjectByKey(rules.minimumAvailableByRole),
    minimumAvailableByClass: sortedObjectByKey(rules.minimumAvailableByClass),
    requireAtLeastOneAvailablePerClass: rules.requireAtLeastOneAvailablePerClass,
    minimumAvailablePerClass: rules.minimumAvailablePerClass,
    planningWindowWeeks: rules.planningWindowWeeks,
    scoring: {
      lowBenchCountWeight: rules.scoring.lowBenchCountWeight,
      notRecentlyBenchedWeight: rules.scoring.notRecentlyBenchedWeight,
      backToBackBenchPenalty: rules.scoring.backToBackBenchPenalty,
      recentlyUnavailablePenalty: rules.scoring.recentlyUnavailablePenalty,
      adjacentUnavailablePenalty: rules.scoring.adjacentUnavailablePenalty,
    },
    source: rules.source,
  };
}

function getFallbackBenchRules(): BenchRuleParseResult {
  return {
    rules: normalizeBenchRules(fallbackBenchRules),
    importedRuleCount: 0,
    source: "fallback",
  };
}

function parseBenchRules(rows: SheetRow[] | null): BenchRuleParseResult {
  if (!rows) {
    return getFallbackBenchRules();
  }

  const header = findOptionalHeaderRow(rows, benchRuleColumns, "Bench Rules");

  if (!header) {
    return getFallbackBenchRules();
  }

  const hardRules = {
    neverBenchPlayers: [] as string[],
    avoidBenchingTogether: [] as [string, string][],
    minimumAvailableByRole: {} as Record<string, number>,
    minimumAvailableByClass: {} as Record<string, number>,
    requireAtLeastOneAvailablePerClass: false,
    minimumAvailablePerClass: 1,
  };
  const scoring = { ...defaultScoring };
  let planningWindowWeeks = defaultPlanningWindowWeeks;
  let hasPlanningWindowRule = false;
  let importedRuleCount = 0;
  let hardRuleCount = 0;

  rows.slice(header.index + 1).forEach((row, rowOffset) => {
    const rowNumber = header.index + rowOffset + 2;
    const enabled = getCell(row, header.indexes.enabled);

    if (!isEnabledRule(enabled)) {
      return;
    }

    const ruleType = normalizeRuleType(getCell(row, header.indexes.ruleType));
    const player1 = cleanPlayerName(getCell(row, header.indexes.player1));
    const player2 = cleanPlayerName(getCell(row, header.indexes.player2));
    const className = normalizeClassName(getCell(row, header.indexes.class));
    const role = normalizeRoleName(getCell(row, header.indexes.role));
    const minAvailable = asOptionalNumber(getCell(row, header.indexes.minAvailable));
    const rawWeight = getCell(row, header.indexes.weight);
    const weight = asOptionalNumber(rawWeight);

    switch (ruleType) {
      case "NEVER_BENCH_PLAYER":
        if (!player1) {
          warn(`Bench Rules row ${rowNumber}: NEVER_BENCH_PLAYER requires Player 1 and was skipped.`);
          return;
        }

        hardRules.neverBenchPlayers.push(getPlayerSlug(player1));
        hardRuleCount += 1;
        importedRuleCount += 1;
        return;

      case "AVOID_BENCH_TOGETHER":
        if (!player1 || !player2) {
          warn(`Bench Rules row ${rowNumber}: AVOID_BENCH_TOGETHER requires Player 1 and Player 2 and was skipped.`);
          return;
        }

        hardRules.avoidBenchingTogether.push([getPlayerSlug(player1), getPlayerSlug(player2)]);
        hardRuleCount += 1;
        importedRuleCount += 1;
        return;

      case "MIN_AVAILABLE_ROLE":
        if (!role || minAvailable === undefined) {
          warn(`Bench Rules row ${rowNumber}: MIN_AVAILABLE_ROLE requires Role and Min Available and was skipped.`);
          return;
        }

        hardRules.minimumAvailableByRole[role] = minAvailable;
        hardRuleCount += 1;
        importedRuleCount += 1;
        return;

      case "MIN_AVAILABLE_CLASS":
        if (!className || minAvailable === undefined) {
          warn(`Bench Rules row ${rowNumber}: MIN_AVAILABLE_CLASS requires Class and Min Available and was skipped.`);
          return;
        }

        hardRules.minimumAvailableByClass[className] = minAvailable;
        hardRuleCount += 1;
        importedRuleCount += 1;
        return;

      case "REQUIRE_ONE_PER_CLASS":
        hardRules.requireAtLeastOneAvailablePerClass = true;
        hardRules.minimumAvailablePerClass = minAvailable ?? 1;
        hardRuleCount += 1;
        importedRuleCount += 1;
        return;

      case "WEIGHT_LOW_BENCH_COUNT":
        if (rawWeight && weight === undefined) {
          warn(`Bench Rules row ${rowNumber}: WEIGHT_LOW_BENCH_COUNT has an invalid Weight and was skipped.`);
          return;
        }

        scoring.lowBenchCountWeight = weight ?? defaultScoring.lowBenchCountWeight;
        importedRuleCount += 1;
        return;

      case "WEIGHT_NOT_RECENTLY_BENCHED":
        if (rawWeight && weight === undefined) {
          warn(`Bench Rules row ${rowNumber}: WEIGHT_NOT_RECENTLY_BENCHED has an invalid Weight and was skipped.`);
          return;
        }

        scoring.notRecentlyBenchedWeight = weight ?? defaultScoring.notRecentlyBenchedWeight;
        importedRuleCount += 1;
        return;

      case "PENALTY_BACK_TO_BACK_BENCH":
        if (rawWeight && weight === undefined) {
          warn(`Bench Rules row ${rowNumber}: PENALTY_BACK_TO_BACK_BENCH has an invalid Weight and was skipped.`);
          return;
        }

        scoring.backToBackBenchPenalty = weight ?? defaultScoring.backToBackBenchPenalty;
        importedRuleCount += 1;
        return;

      case "PLANNING_WINDOW_WEEKS":
        if (hasPlanningWindowRule) {
          warn(`Bench Rules row ${rowNumber}: duplicate PLANNING_WINDOW_WEEKS ignored; using the first valid value.`);
          return;
        }

        if (minAvailable === undefined || minAvailable < 1) {
          warn(`Bench Rules row ${rowNumber}: PLANNING_WINDOW_WEEKS requires Min Available of 1 or greater; using default ${defaultPlanningWindowWeeks}.`);
          return;
        }

        planningWindowWeeks = Math.floor(minAvailable);
        hasPlanningWindowRule = true;
        importedRuleCount += 1;
        return;

      case "PENALTY_RECENTLY_UNAVAILABLE":
        if (rawWeight && weight === undefined) {
          warn(`Bench Rules row ${rowNumber}: PENALTY_RECENTLY_UNAVAILABLE has an invalid Weight; using default ${defaultScoring.recentlyUnavailablePenalty}.`);
        }

        scoring.recentlyUnavailablePenalty = weight ?? defaultScoring.recentlyUnavailablePenalty;
        importedRuleCount += 1;
        return;

      case "PENALTY_ADJACENT_UNAVAILABLE":
        if (rawWeight && weight === undefined) {
          warn(`Bench Rules row ${rowNumber}: PENALTY_ADJACENT_UNAVAILABLE has an invalid Weight; using default ${defaultScoring.adjacentUnavailablePenalty}.`);
        }

        scoring.adjacentUnavailablePenalty = weight ?? defaultScoring.adjacentUnavailablePenalty;
        importedRuleCount += 1;
        return;

      default:
        warn(`Bench Rules row ${rowNumber}: unknown rule type "${getCell(row, header.indexes.ruleType)}" was skipped.`);
    }
  });

  if (hardRuleCount === 0) {
    warn("Bench Rules tab has no enabled valid hard rules; using fallback hard bench rules.");
    Object.assign(hardRules, fallbackHardRules);
  }

  return {
    rules: normalizeBenchRules({
      ...hardRules,
      planningWindowWeeks,
      scoring,
      source: "sheet",
    }),
    importedRuleCount,
    source: "sheet",
  };
}

function parsePlayer(value: string): PlayerInfo {
  const characterRealm = cleanText(value);
  const match = /^(.+)-([^-]+)$/.exec(characterRealm);

  return {
    player: cleanPlayerName(match?.[1] ?? characterRealm),
    realm: cleanText(match?.[2] ?? ""),
    characterRealm,
  };
}

function cleanItem(value: string) {
  return cleanText(value).replace(/^\[(.*)\]$/, "$1");
}

function parseLootDate(value: string) {
  const text = cleanText(value);
  const iso = parseExplicitIsoDate(text);

  if (iso) {
    return formatIsoDate(iso.year, iso.month, iso.day);
  }

  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);

  if (!slashDate) {
    return text.split(" ")[0] ?? "";
  }

  const [, month, day, rawYear] = slashDate;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  return formatIsoDate(year, Number(month), Number(day));
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(cleanText(value));

  if (!match) {
    return 0;
  }

  const [, hours, minutes, seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function emptySummary(playerInfo: PlayerInfo): LootSummaryRow {
  return {
    player: playerInfo.player,
    realm: playerInfo.realm,
    characterRealm: playerInfo.characterRealm || playerInfo.player,
    bis: 0,
    major: 0,
    minor: 0,
    offspec: 0,
    bonusRolls: 0,
    total: 0,
  };
}

function applySummaryCount(summary: LootSummaryRow, response: string) {
  switch (response.toLowerCase()) {
    case "best in slot":
      summary.bis += 1;
      break;
    case "major upgrade":
      summary.major += 1;
      break;
    case "minor upgrade":
      summary.minor += 1;
      break;
    case "off spec":
    case "offspec":
      summary.offspec += 1;
      break;
    case "bonus loot":
    case "bonus roll":
    case "bonus rolls":
      summary.bonusRolls += 1;
      break;
  }
}

function parseLoot(rows: SheetRow[], roster: RosterRow[]) {
  const header = findHeaderRow(rows, lootColumns, "Loot");
  failIfErrors();

  const rosterSlugs = new Set(roster.map((row) => getPlayerSlug(row.character)));
  const summaryByPlayer = new Map<string, LootSummaryRow>();
  const responseCounts = new Map<string, number>();
  const historyWithTime = rows
    .slice(header.index + 1)
    .map((row, rowOffset): (LootHistoryRow & { _time: number }) | null => {
      const rawPlayer = getCell(row, header.indexes.player);
      const playerInfo = parsePlayer(rawPlayer);
      const item = cleanItem(getCell(row, header.indexes.item));
      const response = getCell(row, header.indexes.response);

      if (!rawPlayer && !item && row.every((value) => !cleanText(value))) {
        return null;
      }

      if (!playerInfo.player || !item) {
        warn(`Loot row ${header.index + rowOffset + 2} is missing player or item and was skipped.`);
        return null;
      }

      if (!rosterSlugs.has(getPlayerSlug(playerInfo.player))) {
        warn(`Loot recipient "${playerInfo.player}" does not map to a current roster slug.`);
      }

      if (!summaryByPlayer.has(playerInfo.player)) {
        summaryByPlayer.set(playerInfo.player, emptySummary(playerInfo));
      }

      applySummaryCount(summaryByPlayer.get(playerInfo.player)!, response);
      responseCounts.set(response || "(blank)", (responseCounts.get(response || "(blank)") ?? 0) + 1);

      return {
        date: parseLootDate(getCell(row, header.indexes.date)),
        player: playerInfo.player,
        realm: playerInfo.realm,
        characterRealm: playerInfo.characterRealm,
        item,
        boss: getCell(row, header.indexes.boss),
        instance: getCell(row, header.indexes.instance),
        type: response,
        _time: parseTime(getCell(row, header.indexes.time)),
      };
    })
    .filter((row): row is LootHistoryRow & { _time: number } => Boolean(row));

  const history = historyWithTime
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b._time - a._time ||
        a.player.localeCompare(b.player, undefined, { sensitivity: "base" }) ||
        a.item.localeCompare(b.item, undefined, { sensitivity: "base" }),
    )
    .map(({ _time, ...row }) => row);

  const lootSummary = [...summaryByPlayer.values()]
    .map((summary) => ({
      ...summary,
      total: summary.bis + summary.major + summary.minor,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.player.localeCompare(b.player, undefined, { sensitivity: "base" }),
    );

  return {
    history,
    lootSummary,
    responseCounts: Object.fromEntries([...responseCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  };
}

function buildBench(calendar: CalendarData) {
  return calendar.players
    .map((player): BenchRow => {
      const benchDates = calendar.raidDates.filter((date) => player.schedule[date.label] === "Bench");

      return {
        player: player.name,
        totalBenchCount: benchDates.length,
        lastBenched: benchDates.at(-1)?.isoDate ?? "",
        notes:
          benchDates.length > 0
            ? `Scheduled: ${benchDates.map((date) => date.isoDate).join(", ")}`
            : "No bench dates listed",
      };
    })
    .filter((player) => player.totalBenchCount > 0)
    .sort(
      (a, b) =>
        b.totalBenchCount - a.totalBenchCount ||
        a.player.localeCompare(b.player, undefined, { sensitivity: "base" }),
    );
}

function formatJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readTextIfExists(relativePath: string) {
  const targetPath = path.join(root, relativePath);

  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return "";
  }
}

async function jsonWouldChange(relativePath: string, value: unknown) {
  const previous = await readTextIfExists(relativePath);
  return previous !== formatJson(value);
}

async function writeJson(relativePath: string, value: unknown) {
  const targetPath = path.join(root, relativePath);
  await fs.writeFile(targetPath, formatJson(value), "utf8");
}

async function writeJsonIfChanged(relativePath: string, value: unknown) {
  if (!(await jsonWouldChange(relativePath, value))) {
    return false;
  }

  await writeJson(relativePath, value);
  return true;
}

async function readExistingRaidDates() {
  try {
    const raw = await fs.readFile(path.join(root, "src/data/calendar.json"), "utf8");
    const parsed = JSON.parse(raw) as { raidDates?: RaidDate[] };

    return Array.isArray(parsed.raidDates) ? parsed.raidDates : [];
  } catch {
    return [];
  }
}

async function main() {
  failIfErrors();

  const sheets = await createSheetsClient();
  const warningsBeforeBenchRules = warnings.size;
  const [calendarRows, lootRows, benchRulesRows] = await Promise.all([
    fetchSheetRows(sheets, env.GOOGLE_SHEET_ID, ranges.calendar, "Calendar"),
    fetchSheetRows(sheets, env.GOOGLE_SHEET_ID, ranges.loot, "Loot"),
    fetchOptionalSheetRows(sheets, env.GOOGLE_SHEET_ID, ranges.benchRules, "Bench Rules"),
  ]);
  const benchRules = parseBenchRules(benchRulesRows);
  const benchRuleWarnings = warnings.size - warningsBeforeBenchRules;
  const existingRaidDates = await readExistingRaidDates();
  const { roster, calendar } = parseCalendar(calendarRows, existingRaidDates);
  const loot = parseLoot(lootRows, roster);
  const bench = buildBench(calendar);
  const sourceDataFiles = [
    { path: "src/data/roster.json", data: roster },
    { path: "src/data/calendar.json", data: calendar },
    { path: "src/data/lootHistory.json", data: loot.history },
    { path: "src/data/lootSummary.json", data: loot.lootSummary },
    { path: "src/data/bench.json", data: bench },
    { path: "src/data/benchRules.json", data: benchRules.rules },
  ];
  const changedFiles: string[] = [];
  const changedSourceFiles: string[] = [];

  for (const file of sourceDataFiles) {
    if (await jsonWouldChange(file.path, file.data)) {
      changedSourceFiles.push(file.path);
    }
  }

  for (const file of sourceDataFiles) {
    if (changedSourceFiles.includes(file.path)) {
      await writeJson(file.path, file.data);
      changedFiles.push(file.path);
    }
  }

  if (changedSourceFiles.length > 0) {
    const syncMeta = {
      lastDataSyncAt: new Date().toISOString(),
    };

    if (await writeJsonIfChanged("src/data/syncMeta.json", syncMeta)) {
      changedFiles.push("src/data/syncMeta.json");
    }
  }

  const calendarStatuses = calendar.players.reduce((sum, player) => sum + Object.keys(player.schedule).length, 0);
  const benchMarks = bench.reduce((sum, row) => sum + row.totalBenchCount, 0);

  for (const message of warnings) {
    console.warn(`WARNING: ${message}`);
  }

  console.log("");
  console.log("Data sync complete");
  console.log(`Roster players imported from Calendar: ${roster.length}`);
  console.log(`Raid date columns imported: ${calendar.raidDates.length}`);
  console.log(`Calendar statuses imported: ${calendarStatuses}`);
  console.log(`Loot awards imported: ${loot.history.length}`);
  console.log(`Bench marks imported: ${benchMarks}`);
  console.log(`Bench rules source: ${benchRules.source}`);
  console.log(`Bench rules imported: ${benchRules.importedRuleCount}`);
  console.log(`Bench rule warnings: ${benchRuleWarnings}`);
  console.log(`Warnings: ${warnings.size}`);
  console.log(`Files changed: ${changedFiles.length}`);

  if (changedFiles.length > 0) {
    console.log(`Changed files: ${changedFiles.join(", ")}`);
  }
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
