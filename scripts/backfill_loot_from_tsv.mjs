import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/backfill_loot_from_tsv.mjs <history.csv|history.tsv>");
  process.exit(1);
}

const REQUIRED_COLUMNS = ["player", "date", "item", "response", "instance", "boss"];

function cleanText(value) {
  return String(value ?? "").trim();
}

function parsePlayer(value) {
  const characterRealm = cleanText(value);
  const match = /^(.+)-([^-]+)$/.exec(characterRealm);

  return {
    player: match?.[1] ?? characterRealm,
    realm: match?.[2] ?? "",
    characterRealm,
  };
}

function cleanItem(value) {
  return cleanText(value).replace(/^\[(.*)\]$/, "$1");
}

function parseDate(value) {
  const text = cleanText(value);
  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);

  if (!slashDate) {
    return text.split(" ")[0] ?? "";
  }

  const [, month, day, rawYear] = slashDate;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(cleanText(value));

  if (!match) {
    return 0;
  }

  const [, hours, minutes, seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => cleanText(value))) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    if (row.some((value) => cleanText(value))) {
      rows.push(row);
    }
  }

  return rows;
}

function parseHistory(text) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = parseDelimited(text, delimiter);
  const headers = rows.shift()?.map(cleanText) ?? [];
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

  if (missing.length > 0) {
    throw new Error(`History file missing columns: ${missing.join(", ")}`);
  }

  return rows.map((values) => {
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function emptySummary(player, playerInfo = {}) {
  return {
    player,
    realm: playerInfo.realm ?? "",
    characterRealm: playerInfo.characterRealm ?? player,
    bis: 0,
    major: 0,
    minor: 0,
    offspec: 0,
    bonusRolls: 0,
    total: 0,
  };
}

function applySummaryCount(summary, response) {
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

function sortByPlayer(a, b) {
  return a.player.localeCompare(b.player, undefined, { sensitivity: "base" });
}

const rawTsv = await fs.readFile(inputPath, "utf8");
const sourceRows = parseHistory(rawTsv);
const summaryByPlayer = new Map();
const responseCounts = new Map();

const history = sourceRows
  .map((row) => {
    const playerInfo = parsePlayer(row.player);
    const player = playerInfo.player;
    const item = cleanItem(row.item);
    const response = cleanText(row.response);

    if (!player || !item) {
      return null;
    }

    if (!summaryByPlayer.has(player)) {
      summaryByPlayer.set(player, emptySummary(player, playerInfo));
    }

    applySummaryCount(summaryByPlayer.get(player), response);
    responseCounts.set(response || "(blank)", (responseCounts.get(response || "(blank)") ?? 0) + 1);

    return {
      date: parseDate(row.date),
      player,
      realm: playerInfo.realm,
      characterRealm: playerInfo.characterRealm,
      item,
      boss: cleanText(row.boss),
      instance: cleanText(row.instance),
      type: response,
      _time: parseTime(row.time),
    };
  })
  .filter(Boolean)
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
  .sort((a, b) => b.total - a.total || sortByPlayer(a, b));

await fs.writeFile(path.join(dataDir, "lootHistory.json"), `${JSON.stringify(history, null, 2)}\n`, "utf8");
await fs.writeFile(path.join(dataDir, "lootSummary.json"), `${JSON.stringify(lootSummary, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      sourceRows: sourceRows.length,
      lootHistory: history.length,
      lootSummary: lootSummary.length,
      responses: Object.fromEntries([...responseCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    },
    null,
    2,
  ),
);
