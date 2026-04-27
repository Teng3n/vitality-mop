import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/backfill_calendar_from_csv.mjs <calendar.csv>");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(Boolean)) {
      rows.push(row);
    }
  }

  return rows;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function asNumber(value) {
  const parsed = Number(cleanText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function valuesByDate(row, dates, dateStartIndex) {
  return Object.fromEntries(
    dates.map((date, offset) => [date, cleanText(row[dateStartIndex + offset])]).filter(([, value]) => value),
  );
}

const csv = await fs.readFile(inputPath, "utf8");
const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
const dateRow = rows.find((row) => row.includes("Date"));
const playerHeaderRowIndex = rows.findIndex((row) => row[4] === "Name");

if (!dateRow || playerHeaderRowIndex < 0) {
  throw new Error("Could not find the Calendar date row or player header row.");
}

const dateLabelIndex = dateRow.findIndex((value) => value === "Date");
const dateStartIndex = dateRow.findIndex((value, index) => index > dateLabelIndex && cleanText(value));
const dates = dateRow.slice(dateStartIndex).map(cleanText).filter(Boolean);

const summaryRowLabels = new Map([
  ["Progression", "Progression"],
  ["MIA", "MIA"],
  ["Out", "Out"],
  ["Late", "Late"],
  ["Bench", "Bench"],
]);

const summary = rows
  .slice(0, playerHeaderRowIndex)
  .map((row) => {
    const rawLabel = cleanText(row[12]);
    const label = summaryRowLabels.get(rawLabel);

    if (!label) {
      return null;
    }

    return {
      label,
      values: valuesByDate(row, dates, dateStartIndex),
    };
  })
  .filter(Boolean);

const availableRow = rows.slice(0, playerHeaderRowIndex).find((row) => !cleanText(row[12]) && row.slice(dateStartIndex).some(Boolean));
if (availableRow) {
  summary.push({
    label: "Available",
    values: valuesByDate(availableRow, dates, dateStartIndex),
  });
}

const players = rows
  .slice(playerHeaderRowIndex + 1)
  .map((row) => {
    const name = cleanText(row[4]);

    if (!name) {
      return null;
    }

    return {
      rank: asNumber(row[1]),
      name,
      bis: asNumber(row[5]),
      major: asNumber(row[6]),
      minor: asNumber(row[7]),
      total: asNumber(row[8]),
      bonusRolls: asNumber(row[9]),
      offspec: asNumber(row[10]),
      mia: asNumber(row[11]),
      out: asNumber(row[12]),
      late: asNumber(row[13]),
      bench: asNumber(row[14]),
      schedule: valuesByDate(row, dates, dateStartIndex),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

const calendar = {
  dates,
  summary,
  players,
};

await fs.writeFile(path.join(dataDir, "calendar.json"), `${JSON.stringify(calendar, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      dates: dates.length,
      summaryRows: summary.length,
      players: players.length,
      statusCells: players.reduce((sum, player) => sum + Object.keys(player.schedule).length, 0),
    },
    null,
    2,
  ),
);
