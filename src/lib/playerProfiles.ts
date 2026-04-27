import bench from "../data/bench.json";
import calendar from "../data/calendar.json";
import lootHistory from "../data/lootHistory.json";
import lootSummary from "../data/lootSummary.json";
import roster from "../data/roster.json";
import { cleanPlayerName, getPlayerProfileHref, getPlayerSlug, normalizePlayerName } from "./playerNames";

interface RosterMember {
  character: string;
  class: string;
  spec: string;
  role: string;
}

interface LootSummaryRow {
  player: string;
  bis: number;
  major: number;
  minor: number;
  offspec: number;
  bonusRolls: number;
  total: number;
}

interface LootHistoryRow {
  date: string;
  player: string;
  item: string;
  boss: string;
  instance: string;
  type: string;
}

interface BenchRow {
  player: string;
  totalBenchCount: number;
  lastBenched: string;
  notes: string;
}

interface CalendarPlayer {
  name: string;
  schedule: Record<string, string | undefined>;
}

interface RaidDate {
  label: string;
  isoDate: string;
}

interface CalendarData {
  raidDates: RaidDate[];
  players: CalendarPlayer[];
}

export interface PlayerProfile {
  character: string;
  slug: string;
  href: string;
  className?: string;
  spec?: string;
  role?: string;
  rosterStatus: "Active roster" | "Not on active roster";
  attendance: {
    raidNights: number;
    bench: number;
    out: number;
    late: number;
    mia: number;
    trial: number;
  };
  benchSummary?: BenchRow;
  lastBenchDate?: { label: string; isoDate: string };
  benchHistory: Array<{ label: string; isoDate: string; status: string }>;
  upcomingBenchDates: Array<{ label: string; isoDate: string }>;
  lootSummary: LootSummaryRow;
  recentLoot: LootHistoryRow[];
  notes: string[];
  warcraftLogsUrl: string;
  warcraftLogsDirectUrl?: string;
}

const rosterRows = roster as unknown as RosterMember[];
const lootSummaryRows = lootSummary as unknown as LootSummaryRow[];
const lootHistoryRows = lootHistory as unknown as LootHistoryRow[];
const benchRows = bench as unknown as BenchRow[];
const calendarData = calendar as unknown as CalendarData;

const byNormalizedName = <T>(rows: T[], getName: (row: T) => string) =>
  new Map(rows.map((row) => [normalizePlayerName(getName(row)), row]));

const rosterByName = byNormalizedName(rosterRows, (row) => row.character);
const lootSummaryByName = byNormalizedName(lootSummaryRows, (row) => row.player);
const benchByName = byNormalizedName(benchRows, (row) => row.player);
const calendarByName = byNormalizedName(calendarData.players, (row) => row.name);

const emptyLootSummary = (player: string): LootSummaryRow => ({
  player,
  bis: 0,
  major: 0,
  minor: 0,
  offspec: 0,
  bonusRolls: 0,
  total: 0,
});

const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const dateByIso = new Map(calendarData.raidDates.map((date) => [date.isoDate, date]));
const isoDatePattern = /\d{4}-\d{2}-\d{2}/g;
const getDateLabel = (isoDate: string) => dateByIso.get(isoDate)?.label ?? isoDate;

const todayIso = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
};

const getBenchSummaryDates = (benchSummary?: BenchRow) => {
  if (!benchSummary) {
    return [];
  }

  const dates = new Set<string>();

  if (benchSummary.lastBenched.match(/^\d{4}-\d{2}-\d{2}$/)) {
    dates.add(benchSummary.lastBenched);
  }

  for (const date of benchSummary.notes.match(isoDatePattern) ?? []) {
    dates.add(date);
  }

  return [...dates].map((isoDate) => ({ label: getDateLabel(isoDate), isoDate }));
};

const getUniquePlayerNames = () => {
  const names = new Map<string, string>();
  const add = (name: string) => {
    const cleaned = cleanPlayerName(name);
    const slug = getPlayerSlug(cleaned);

    if (slug && !names.has(slug)) {
      names.set(slug, cleaned);
    }
  };

  rosterRows.forEach((row) => add(row.character));
  calendarData.players.forEach((row) => add(row.name));
  lootSummaryRows.forEach((row) => add(row.player));
  lootHistoryRows.forEach((row) => add(row.player));
  benchRows.forEach((row) => add(row.player));

  return [...names.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
};

export const getPlayerProfile = (name: string): PlayerProfile => {
  const normalized = normalizePlayerName(name);
  const rosterMember = rosterByName.get(normalized);
  const calendarPlayer = calendarByName.get(normalized);
  const lootSummaryRow = lootSummaryByName.get(normalized) ?? emptyLootSummary(cleanPlayerName(name));
  const benchSummary = benchByName.get(normalized);
  const today = todayIso();
  const statusDates =
    calendarPlayer?.schedule
      ? calendarData.raidDates
          .map((date) => ({
            ...date,
            status: calendarPlayer.schedule[date.label] ?? "",
          }))
          .filter((date) => date.status)
      : [];
  const benchHistory = statusDates.filter((date) => date.status === "Bench");
  const attendance = {
    raidNights: calendarData.raidDates.length,
    bench: benchHistory.length,
    out: statusDates.filter((date) => date.status === "Out").length,
    late: statusDates.filter((date) => date.status === "Late").length,
    mia: statusDates.filter((date) => date.status === "MIA").length,
    trial: statusDates.filter((date) => date.status === "Trial").length,
  };
  const recentLoot = lootHistoryRows
    .filter((row) => normalizePlayerName(row.player) === normalized)
    .sort((a, b) => b.date.localeCompare(a.date));
  const trialDates = statusDates.filter((date) => date.status === "Trial");
  const notes = [
    rosterMember ? "Active roster profile." : "Not currently listed on the active roster.",
    trialDates.length > 0
      ? `Trial status appears on ${trialDates.length} raid night${trialDates.length === 1 ? "" : "s"}.`
      : "No public trial status recorded.",
    "Officer/private notes are not exposed on the site.",
  ];
  const displayName = cleanPlayerName(rosterMember?.character ?? calendarPlayer?.name ?? name);
  const sortedBenchHistory = benchHistory.sort(
    (a, b) => parseIsoDate(b.isoDate).getTime() - parseIsoDate(a.isoDate).getTime(),
  );
  const benchDateByIso = new Map(
    [...sortedBenchHistory, ...getBenchSummaryDates(benchSummary)].map((date) => [
      date.isoDate,
      { label: getDateLabel(date.isoDate), isoDate: date.isoDate },
    ]),
  );
  const allBenchDates = [...benchDateByIso.values()];
  const lastBenchDate = allBenchDates
    .filter((date) => date.isoDate < today)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))[0];
  const upcomingBenchDates = allBenchDates
    .filter((date) => date.isoDate >= today)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .map(({ label, isoDate }) => ({ label, isoDate }));

  return {
    character: displayName,
    slug: getPlayerSlug(displayName),
    href: getPlayerProfileHref(displayName),
    className: rosterMember?.class,
    spec: rosterMember?.spec,
    role: rosterMember?.role,
    rosterStatus: rosterMember ? "Active roster" : "Not on active roster",
    attendance,
    benchSummary,
    lastBenchDate,
    benchHistory: allBenchDates
      .filter((date) => date.isoDate < today)
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
      .map((date) => ({ ...date, status: "Bench" })),
    upcomingBenchDates,
    lootSummary: {
      ...lootSummaryRow,
      player: cleanPlayerName(lootSummaryRow.player),
    },
    recentLoot: recentLoot.map((row) => ({ ...row, player: cleanPlayerName(row.player) })),
    notes,
    warcraftLogsUrl: `https://classic.warcraftlogs.com/search/?term=${encodeURIComponent(displayName)}`,
  };
};

export const getPlayerProfiles = () => getUniquePlayerNames().map((name) => getPlayerProfile(name));
