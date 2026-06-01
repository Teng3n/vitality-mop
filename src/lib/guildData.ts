import bench from "../data/bench.json";
import calendar from "../data/calendar.json";
import lootHistory from "../data/lootHistory.json";
import lootSummary from "../data/lootSummary.json";
import roster from "../data/roster.json";
import { cleanPlayerName, getPlayerProfileHref, getPlayerSlug, normalizePlayerName } from "./playerNames";
import { getWarcraftLogsCharacterUrl, getWarcraftLogsSearchUrl } from "./warcraftLogs";

export const RAID_NAME = "Throne of Thunder";
export const MAIN_SPEC_LOOT_TYPES = new Set(["best in slot", "major upgrade", "minor upgrade", "bonus loot"]);
export const CALENDAR_STATUSES = ["Bench", "Out", "Late", "MIA", "Trial"] as const;

export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

interface RosterRow {
  character: string;
  class: string;
  spec: string;
  role: string;
  realm?: string;
}

interface CalendarSummary {
  label: string;
  values: Record<string, string>;
}

interface CalendarPlayer {
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

interface RaidDate {
  label: string;
  isoDate: string;
}

interface CalendarData {
  raidDates: RaidDate[];
  summary: CalendarSummary[];
  players: CalendarPlayer[];
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

export interface Player {
  slug: string;
  name: string;
  className: string;
  spec: string;
  role: string;
  realm?: string;
  status: "Active roster";
  officer: boolean;
  trial: boolean;
  warcraftLogsUrl: string;
  warcraftLogsDirectUrl?: string;
  href: string;
}

export interface StatusPlayer {
  slug: string;
  name: string;
  className?: string;
  href: string;
}

export interface RaidNight {
  label: string;
  isoDate: string;
  raidName: string;
  bench: StatusPlayer[];
  out: StatusPlayer[];
  late: StatusPlayer[];
  mia: StatusPlayer[];
  trial: StatusPlayer[];
  availableCount: number;
  missingStatusPlayers: StatusPlayer[];
}

export interface LootAward {
  date: string;
  playerSlug: string;
  player: string;
  item: string;
  boss: string;
  instance: string;
  responseType: string;
  countsTowardMainSpecTotal: boolean;
}

export interface LootSummary {
  playerSlug: string;
  player: string;
  bis: number;
  major: number;
  minor: number;
  offspec: number;
  bonusRolls: number;
  total: number;
  activeRoster: boolean;
}

export interface BenchSummary {
  playerSlug: string;
  player: string;
  pastBenchDates: RaidDate[];
  futureBenchDates: RaidDate[];
  lastBenched: RaidDate | null;
  nextBench: RaidDate | null;
  pastBenchCount: number;
  futureBenchCount: number;
  totalScheduledBenchNights: number;
}

const rosterRows = roster as RosterRow[];
const calendarData = calendar as unknown as CalendarData;
const lootSummaryRows = lootSummary as LootSummaryRow[];
const lootHistoryRows = lootHistory as LootHistoryRow[];
const benchRows = bench as BenchRow[];
const officerNames = new Set(["tengen", "drchicken", "karkan"]);
const isoDatePattern = /\d{4}-\d{2}-\d{2}/g;

const byNormalizedName = <T>(rows: T[], getName: (row: T) => string) =>
  new Map(rows.map((row) => [normalizePlayerName(getName(row)), row]));

const calendarByName = byNormalizedName(calendarData.players, (row) => row.name);
const dateByIso = new Map(calendarData.raidDates.map((date) => [date.isoDate, date]));

export const raidDates = [...calendarData.raidDates].sort((a, b) => a.isoDate.localeCompare(b.isoDate));

export const getTodayIso = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
};

export const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const formatDateLabel = (isoDate: string) => dateByIso.get(isoDate)?.label ?? isoDate;

export const players: Player[] = rosterRows
  .map((row) => {
    const name = cleanPlayerName(row.character);
    const realm = row.realm?.trim() ?? "";

    return {
      slug: getPlayerSlug(name),
      name,
      className: row.class,
      spec: row.spec,
      role: row.role,
      realm,
      status: "Active roster" as const,
      officer: officerNames.has(normalizePlayerName(name)),
      trial: false,
      warcraftLogsUrl: getWarcraftLogsSearchUrl(name),
      warcraftLogsDirectUrl: realm ? getWarcraftLogsCharacterUrl(name, realm) : undefined,
      href: getPlayerProfileHref(name),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

export const activeRosterPlayers = players;
export const playersBySlug = new Map(players.map((player) => [player.slug, player]));
export const playersByName = new Map(players.map((player) => [normalizePlayerName(player.name), player]));

export const getPlayerByName = (name: string) => playersByName.get(normalizePlayerName(name));

export const getStatusPlayer = (name: string): StatusPlayer => {
  const rosterPlayer = getPlayerByName(name);
  const cleaned = cleanPlayerName(rosterPlayer?.name ?? name);

  return {
    slug: rosterPlayer?.slug ?? getPlayerSlug(cleaned),
    name: cleaned,
    className: rosterPlayer?.className,
    href: getPlayerProfileHref(cleaned),
  };
};

const normalizeStatus = (status: string | undefined): CalendarStatus | "" => {
  const matched = CALENDAR_STATUSES.find((candidate) => candidate.toLowerCase() === (status ?? "").toLowerCase());
  return matched ?? "";
};

export const getRaidNight = (date: RaidDate): RaidNight => {
  const statuses = new Map<CalendarStatus, StatusPlayer[]>(CALENDAR_STATUSES.map((status) => [status, []]));
  const activePlayersWithoutCalendarRow = activeRosterPlayers
    .filter((player) => !calendarByName.has(normalizePlayerName(player.name)))
    .map((player) => getStatusPlayer(player.name));

  for (const player of calendarData.players) {
    const status = normalizeStatus(player.schedule?.[date.label]);

    if (status) {
      statuses.get(status)?.push(getStatusPlayer(player.name));
    }
  }

  const bench = statuses.get("Bench") ?? [];
  const out = statuses.get("Out") ?? [];
  const late = statuses.get("Late") ?? [];
  const mia = statuses.get("MIA") ?? [];
  const unavailableCount = bench.length + out.length + late.length + mia.length;

  return {
    ...date,
    raidName: RAID_NAME,
    bench,
    out,
    late,
    mia,
    trial: statuses.get("Trial") ?? [],
    availableCount: Math.max(activeRosterPlayers.length - unavailableCount, 0),
    missingStatusPlayers: activePlayersWithoutCalendarRow,
  };
};

export const raidNights = raidDates.map((date) => getRaidNight(date));

export const getUpcomingRaidNights = (count = 4, todayIso = getTodayIso()) => {
  const upcoming = raidDates.filter((date) => date.isoDate >= todayIso).slice(0, count);
  const fallback = upcoming.length > 0 ? upcoming : raidDates.slice(-count);

  return fallback.map((date) => getRaidNight(date));
};

const getWeekStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());

export const getThisWeekRaidNights = (todayIso = getTodayIso()) => {
  const today = parseIsoDate(todayIso);
  const upcoming = raidDates.find((date) => date.isoDate >= todayIso) ?? raidDates[raidDates.length - 1];
  const currentWeekStart = getWeekStart(today);
  const currentWeekDates = raidDates.filter(
    (date) => getWeekStart(parseIsoDate(date.isoDate)).getTime() === currentWeekStart.getTime(),
  );
  const hasCurrentOrUpcomingRaidThisWeek = currentWeekDates.some((date) => date.isoDate >= todayIso);
  const targetWeekStart =
    hasCurrentOrUpcomingRaidThisWeek && (today.getDay() === 0 || today.getDay() === 1)
      ? currentWeekStart
      : getWeekStart(parseIsoDate(upcoming.isoDate));

  return raidDates
    .filter((date) => getWeekStart(parseIsoDate(date.isoDate)).getTime() === targetWeekStart.getTime())
    .slice(0, 2)
    .map((date) => getRaidNight(date));
};

export const getStatusTotals = (nights: RaidNight[]) => ({
  Bench: nights.reduce((sum, night) => sum + night.bench.length, 0),
  Out: nights.reduce((sum, night) => sum + night.out.length, 0),
  Late: nights.reduce((sum, night) => sum + night.late.length, 0),
  MIA: nights.reduce((sum, night) => sum + night.mia.length, 0),
  Trial: nights.reduce((sum, night) => sum + night.trial.length, 0),
});

export const getPlayersForStatusRange = (nights: RaidNight[], status: CalendarStatus) => {
  const bySlug = new Map<string, StatusPlayer>();

  for (const night of nights) {
    const playersForNight =
      status === "Bench"
        ? night.bench
        : status === "Out"
          ? night.out
          : status === "Late"
            ? night.late
            : status === "MIA"
              ? night.mia
              : night.trial;

    for (const player of playersForNight) {
      bySlug.set(player.slug, player);
    }
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
};

export const countsTowardMainSpecTotal = (responseType: string) =>
  MAIN_SPEC_LOOT_TYPES.has(responseType.trim().toLowerCase());

export const lootAwards: LootAward[] = lootHistoryRows
  .map((row) => {
    const player = cleanPlayerName(row.player);

    return {
      date: row.date,
      playerSlug: getPlayerSlug(player),
      player,
      item: row.item,
      boss: row.boss,
      instance: row.instance,
      responseType: row.type,
      countsTowardMainSpecTotal: countsTowardMainSpecTotal(row.type),
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

export const lootSummaries: LootSummary[] = lootSummaryRows
  .map((row) => {
    const player = cleanPlayerName(row.player);

    return {
      playerSlug: getPlayerSlug(player),
      player,
      bis: row.bis,
      major: row.major,
      minor: row.minor,
      offspec: row.offspec,
      bonusRolls: row.bonusRolls,
      total: row.total,
      activeRoster: playersByName.has(normalizePlayerName(player)),
    };
  })
  .sort((a, b) => a.player.localeCompare(b.player, undefined, { sensitivity: "base" }));

const getBenchDatesFromSummary = (benchSummary?: BenchRow) => {
  if (!benchSummary) {
    return [];
  }

  const dates = new Set<string>();

  if (/^\d{4}-\d{2}-\d{2}$/.test(benchSummary.lastBenched)) {
    dates.add(benchSummary.lastBenched);
  }

  for (const date of benchSummary.notes.match(isoDatePattern) ?? []) {
    dates.add(date);
  }

  return [...dates];
};

const getCalendarBenchDates = (playerName: string) => {
  const calendarPlayer = calendarByName.get(normalizePlayerName(playerName));

  if (!calendarPlayer) {
    return [];
  }

  return raidDates
    .filter((date) => calendarPlayer.schedule?.[date.label] === "Bench")
    .map((date) => date.isoDate);
};

export const getBenchSummary = (playerName: string, todayIso = getTodayIso()): BenchSummary => {
  const player = cleanPlayerName(playerName);
  const benchRow = benchRows.find((row) => normalizePlayerName(row.player) === normalizePlayerName(player));
  const allDates = [...new Set([...getCalendarBenchDates(player), ...getBenchDatesFromSummary(benchRow)])]
    .sort((a, b) => a.localeCompare(b))
    .map((isoDate) => ({ label: formatDateLabel(isoDate), isoDate }));
  const pastBenchDates = allDates.filter((date) => date.isoDate < todayIso).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  const futureBenchDates = allDates.filter((date) => date.isoDate >= todayIso).sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  return {
    playerSlug: getPlayerSlug(player),
    player,
    pastBenchDates,
    futureBenchDates,
    lastBenched: pastBenchDates[0] ?? null,
    nextBench: futureBenchDates[0] ?? null,
    pastBenchCount: pastBenchDates.length,
    futureBenchCount: futureBenchDates.length,
    totalScheduledBenchNights: allDates.length,
  };
};

export const benchSummaries = activeRosterPlayers
  .map((player) => getBenchSummary(player.name))
  .sort(
    (a, b) =>
      b.totalScheduledBenchNights - a.totalScheduledBenchNights ||
      a.player.localeCompare(b.player, undefined, { sensitivity: "base" }),
  );

export const lootSummaryBySlug = new Map(
  lootSummaryRows.map((row) => {
    const player = cleanPlayerName(row.player);
    return [getPlayerSlug(player), { ...row, player }];
  }),
);

export const calendarDataRaw = calendarData;
export const rosterRowsRaw = rosterRows;
