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
  roster: cleanText(process.env.ROSTER_RANGE) || "Roster!A:Z",
  calendar: cleanText(process.env.CALENDAR_RANGE) || "Calendar!A:ZZ",
  loot: cleanText(process.env.LOOT_RANGE) || "History!A:Z",
};

for (const key of requiredEnv) {
  if (!env[key]) {
    errors.push(`Missing required environment variable: ${key}`);
  }
}

const rosterColumns: ColumnSpec[] = [
  { key: "character", aliases: ["character", "name", "player"], required: true },
  { key: "class", aliases: ["class"], required: true },
  { key: "spec", aliases: ["spec", "specialization"], required: true },
  { key: "role", aliases: ["role"], required: true },
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

const calendarPlayerColumns: ColumnSpec[] = [
  { key: "rank", aliases: ["rank"], required: false },
  { key: "name", aliases: ["name", "player", "character"], required: true },
  { key: "bis", aliases: ["bis", "bestinslot"], required: false },
  { key: "major", aliases: ["major", "majorupgrade"], required: false },
  { key: "minor", aliases: ["minor", "minorupgrade"], required: false },
  { key: "total", aliases: ["total"], required: false },
  { key: "bonusRolls", aliases: ["bonusrolls", "bonusroll", "bonusloot"], required: false },
  { key: "offspec", aliases: ["offspec", "offspecloot", "offspecawards"], required: false },
  { key: "mia", aliases: ["mia"], required: false },
  { key: "out", aliases: ["out"], required: false },
  { key: "late", aliases: ["late"], required: false },
  { key: "bench", aliases: ["bench", "benched"], required: false },
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
      range,
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

function validateRoster(roster: RosterRow[]) {
  const bySlug = new Map<string, string>();

  for (const row of roster) {
    const slug = getPlayerSlug(row.character);

    if (!row.character) {
      errors.push("Roster row is missing a player name.");
    }

    if (bySlug.has(slug)) {
      errors.push(`Duplicate active roster player slug "${slug}" for "${bySlug.get(slug)}" and "${row.character}".`);
    }

    bySlug.set(slug, row.character);
  }
}

function parseRoster(rows: SheetRow[]) {
  const header = findHeaderRow(rows, rosterColumns, "Roster");
  failIfErrors();

  const roster = rows
    .slice(header.index + 1)
    .map((row, rowOffset): RosterRow | null => {
      const character = cleanPlayerName(getCell(row, header.indexes.character));

      if (!character && row.every((value) => !cleanText(value))) {
        return null;
      }

      if (!character) {
        errors.push(`Roster row ${header.index + rowOffset + 2} is missing a character name.`);
        return null;
      }

      const className = getCell(row, header.indexes.class);
      const spec = getCell(row, header.indexes.spec);
      const role = getCell(row, header.indexes.role);

      if (!className || !spec || !role) {
        errors.push(`Roster row for "${character}" is missing class, spec, or role.`);
      }

      return {
        character,
        class: className,
        spec,
        role,
      };
    })
    .filter((row): row is RosterRow => Boolean(row));

  validateRoster(roster);
  failIfErrors();

  return sortByName(roster, (row) => row.character);
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

function valuesByDate(row: SheetRow, dates: string[], dateStartIndex: number) {
  return Object.fromEntries(
    dates
      .map((date, offset) => [date, cleanText(row[dateStartIndex + offset])] as const)
      .filter(([, value]) => value),
  );
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

function normalizeSummaryLabel(value: string) {
  const status = statusAliases.get(normalizeColumn(value));
  return status === "Unknown" ? undefined : status;
}

function getSummaryLabelColumn(rows: SheetRow[], dateStartIndex: number) {
  const counts = new Map<number, number>();

  for (const row of rows) {
    for (let index = 0; index < dateStartIndex; index += 1) {
      const label = normalizeSummaryLabel(row[index] ?? "");

      if (label && label !== "Available") {
        counts.set(index, (counts.get(index) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function parseCalendar(rows: SheetRow[], roster: RosterRow[], existingRaidDates: RaidDate[] = []) {
  const dateRow = rows.find((row) => row.some((value) => normalizeColumn(value) === "date"));

  if (!dateRow) {
    errors.push("Calendar sheet is missing a row with a Date label.");
    failIfErrors();
    throw new Error("Calendar sheet is missing a row with a Date label.");
  }

  const dateLabelIndex = dateRow.findIndex((value) => normalizeColumn(value) === "date");
  const dateStartIndex = dateRow.findIndex((value, index) => index > dateLabelIndex && cleanText(value));

  if (dateStartIndex < 0) {
    errors.push("Calendar sheet has a Date row but no raid date columns.");
    failIfErrors();
  }

  const dates = dateRow.slice(dateStartIndex).map(cleanText).filter(Boolean);
  const raidDates = inferRaidDates(dates, existingRaidDates);
  const header = findHeaderRow(rows, calendarPlayerColumns, "Calendar");
  failIfErrors();

  const rosterSlugs = new Set(roster.map((row) => getPlayerSlug(row.character)));
  const summarySourceRows = rows.slice(0, header.index);
  const summaryLabelColumn = getSummaryLabelColumn(summarySourceRows, dateStartIndex);
  const seenSummaryLabels = new Set<string>();
  const summary: CalendarSummary[] = [];

  for (const row of summarySourceRows) {
    const label =
      summaryLabelColumn === undefined
        ? row.slice(0, dateStartIndex).map(normalizeSummaryLabel).find(Boolean)
        : normalizeSummaryLabel(row[summaryLabelColumn] ?? "");

    if (!label || seenSummaryLabels.has(label)) {
      continue;
    }

    seenSummaryLabels.add(label);
    summary.push({
      label,
      values: valuesByDate(row, dates, dateStartIndex),
    });
  }

  if (!seenSummaryLabels.has("Available")) {
    const availableRow = summarySourceRows.find((row) => {
      const hasDateValues = row.slice(dateStartIndex, dateStartIndex + dates.length).some((value) => cleanText(value));
      const label = summaryLabelColumn === undefined ? "" : cleanText(row[summaryLabelColumn]);

      return hasDateValues && !label && !row.slice(0, dateStartIndex).map(normalizeSummaryLabel).find(Boolean);
    });

    if (availableRow) {
      summary.push({
        label: "Available",
        values: valuesByDate(availableRow, dates, dateStartIndex),
      });
    }
  }

  const players = rows
    .slice(header.index + 1)
    .map((row, rowOffset): CalendarPlayer | null => {
      const name = cleanPlayerName(getCell(row, header.indexes.name));

      if (!name && row.every((value) => !cleanText(value))) {
        return null;
      }

      if (!name) {
        warn(`Calendar row ${header.index + rowOffset + 2} is missing a player name and was skipped.`);
        return null;
      }

      const slug = getPlayerSlug(name);

      if (!rosterSlugs.has(slug)) {
        warn(`Calendar player "${name}" does not map to a current roster slug.`);
      }

      const schedule = Object.fromEntries(
        dates
          .map((date, offset) => {
            const status = normalizeStatus(row[dateStartIndex + offset] ?? "", `${name} ${date}`);
            return [date, status] as const;
          })
          .filter(([, status]) => status),
      );

      return {
        rank: asNumber(getCell(row, header.indexes.rank)) || rowOffset + 1,
        name,
        bis: asNumber(getCell(row, header.indexes.bis)),
        major: asNumber(getCell(row, header.indexes.major)),
        minor: asNumber(getCell(row, header.indexes.minor)),
        total: asNumber(getCell(row, header.indexes.total)),
        bonusRolls: asNumber(getCell(row, header.indexes.bonusRolls)),
        offspec: asNumber(getCell(row, header.indexes.offspec)),
        mia: asNumber(getCell(row, header.indexes.mia)),
        out: asNumber(getCell(row, header.indexes.out)),
        late: asNumber(getCell(row, header.indexes.late)),
        bench: asNumber(getCell(row, header.indexes.bench)),
        schedule,
      };
    })
    .filter((row): row is CalendarPlayer => Boolean(row))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  if (players.length === 0) {
    errors.push("Calendar sheet produced no player rows.");
  }

  failIfErrors();

  return {
    dates,
    raidDates,
    summary,
    players,
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

async function writeJsonIfChanged(relativePath: string, value: unknown) {
  const targetPath = path.join(root, relativePath);
  const next = `${JSON.stringify(value, null, 2)}\n`;
  let previous = "";

  try {
    previous = await fs.readFile(targetPath, "utf8");
  } catch {
    previous = "";
  }

  if (previous === next) {
    return false;
  }

  await fs.writeFile(targetPath, next, "utf8");
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
  const [rosterRows, calendarRows, lootRows] = await Promise.all([
    fetchSheetRows(sheets, env.GOOGLE_SHEET_ID, ranges.roster, "Roster"),
    fetchSheetRows(sheets, env.GOOGLE_SHEET_ID, ranges.calendar, "Calendar"),
    fetchSheetRows(sheets, env.GOOGLE_SHEET_ID, ranges.loot, "Loot"),
  ]);
  const existingRaidDates = await readExistingRaidDates();
  const roster = parseRoster(rosterRows);
  const calendar = parseCalendar(calendarRows, roster, existingRaidDates);
  const loot = parseLoot(lootRows, roster);
  const bench = buildBench(calendar);
  const generatedFiles = [
    { path: "src/data/roster.json", data: roster },
    { path: "src/data/calendar.json", data: calendar },
    { path: "src/data/lootHistory.json", data: loot.history },
    { path: "src/data/lootSummary.json", data: loot.lootSummary },
    { path: "src/data/bench.json", data: bench },
  ];
  const changedFiles: string[] = [];

  for (const file of generatedFiles) {
    if (await writeJsonIfChanged(file.path, file.data)) {
      changedFiles.push(file.path);
    }
  }

  const calendarStatuses = calendar.players.reduce((sum, player) => sum + Object.keys(player.schedule).length, 0);
  const benchMarks = bench.reduce((sum, row) => sum + row.totalBenchCount, 0);

  for (const message of warnings) {
    console.warn(`WARNING: ${message}`);
  }

  console.log("");
  console.log("Data sync complete");
  console.log(`Roster players: ${roster.length}`);
  console.log(`Calendar raid dates: ${calendar.raidDates.length}`);
  console.log(`Calendar statuses: ${calendarStatuses}`);
  console.log(`Loot awards: ${loot.history.length}`);
  console.log(`Bench marks: ${benchMarks}`);
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
