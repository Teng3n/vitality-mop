import bench from "../data/bench.json";
import calendar from "../data/calendar.json";
import lootHistory from "../data/lootHistory.json";
import lootSummary from "../data/lootSummary.json";
import roster from "../data/roster.json";
import { raidNights, type RaidNight, type StatusPlayer } from "./guildData";
import {
  currentLootTierSlug,
  getPlayerLootAwardsForTier,
  getPlayerLootSummaryForTier,
  getPlayerLootTimeline,
  lootTiers,
  type LootTimelinePoint,
} from "./lootTiers";
import { cleanPlayerName, getPlayerProfileHref, getPlayerSlug, normalizePlayerName } from "./playerNames";
import { getWarcraftLogsCharacterUrl, getWarcraftLogsSearchUrl } from "./warcraftLogs";

interface RosterMember {
  character: string;
  class: string;
  spec: string;
  role: string;
  realm?: string;
}

interface LootSummaryRow {
  player: string;
  realm?: string;
  characterRealm?: string;
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
  realm?: string;
  characterRealm?: string;
  item: string;
  boss: string;
  instance: string;
  type: string;
}

export interface PlayerLootTierProfile {
  tierSlug: string;
  tierLabel: string;
  shortLabel: string;
  isCurrent: boolean;
  lootSummary: LootSummaryRow;
  recentLoot: LootHistoryRow[];
  timeline: LootTimelinePoint[];
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
  };
  benchSummary?: BenchRow;
  lastBenchDate?: { label: string; isoDate: string };
  benchHistory: Array<{ label: string; isoDate: string; status: string }>;
  upcomingBenchDates: Array<{ label: string; isoDate: string }>;
  lootSummary: LootSummaryRow;
  recentLoot: LootHistoryRow[];
  lootByTier: PlayerLootTierProfile[];
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
const benchByName = byNormalizedName(benchRows, (row) => row.player);
const calendarByName = byNormalizedName(calendarData.players, (row) => row.name);

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

const statusKeys = {
  Bench: "bench",
  Out: "out",
  Late: "late",
  MIA: "mia",
} as const;

type ProfileStatus = keyof typeof statusKeys;

const getStatusDatesForPlayer = (slug: string, normalizedName: string, status: ProfileStatus) =>
  raidNights
    .filter((night: RaidNight) =>
      night[statusKeys[status]].some(
        (player: StatusPlayer) => player.slug === slug || normalizePlayerName(player.name) === normalizedName,
      ),
    )
    .map((night) => ({ label: night.label, isoDate: night.isoDate, status }));

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
  const benchSummary = benchByName.get(normalized);
  const today = todayIso();
  const displayName = cleanPlayerName(rosterMember?.character ?? calendarPlayer?.name ?? name);
  const playerSlug = getPlayerSlug(displayName);
  const normalizedDisplayName = normalizePlayerName(displayName);
  const benchHistory = getStatusDatesForPlayer(playerSlug, normalizedDisplayName, "Bench");
  const outDates = getStatusDatesForPlayer(playerSlug, normalizedDisplayName, "Out");
  const lateDates = getStatusDatesForPlayer(playerSlug, normalizedDisplayName, "Late");
  const miaDates = getStatusDatesForPlayer(playerSlug, normalizedDisplayName, "MIA");
  const attendance = {
    raidNights: calendarData.raidDates.length,
    bench: benchHistory.length,
    out: outDates.length,
    late: lateDates.length,
    mia: miaDates.length,
  };
  const allRecentLoot = lootHistoryRows
    .filter((row) => normalizePlayerName(row.player) === normalized)
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentTierSummary = getPlayerLootSummaryForTier(displayName, currentLootTierSlug);
  const currentTierLoot = getPlayerLootAwardsForTier(displayName, currentLootTierSlug);
  const lootByTier = lootTiers.map((tier) => ({
    tierSlug: tier.slug,
    tierLabel: tier.label,
    shortLabel: tier.shortLabel,
    isCurrent: tier.slug === currentLootTierSlug,
    lootSummary: getPlayerLootSummaryForTier(displayName, tier.slug),
    recentLoot: getPlayerLootAwardsForTier(displayName, tier.slug),
    timeline: getPlayerLootTimeline(displayName, tier.slug),
  }));
  const notes = [
    rosterMember ? "Active roster profile." : "Not currently listed on the active roster.",
    "Officer/private notes are not exposed on the site.",
  ];
  const realm = rosterMember?.realm || currentTierSummary.realm || allRecentLoot.find((row) => row.realm)?.realm || "";
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
    slug: playerSlug,
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
      ...currentTierSummary,
      player: cleanPlayerName(currentTierSummary.player),
    },
    recentLoot: currentTierLoot.map((row) => ({ ...row, player: cleanPlayerName(row.player) })),
    lootByTier,
    notes,
    warcraftLogsUrl: getWarcraftLogsSearchUrl(displayName),
    warcraftLogsDirectUrl: realm ? getWarcraftLogsCharacterUrl(displayName, realm) : undefined,
  };
};

export const getPlayerProfiles = () => getUniquePlayerNames().map((name) => getPlayerProfile(name));
