import lootHistory from "../data/lootHistory.json";
import archivedThroneOfThunderLootHistory from "../data/lootArchive/throneOfThunderHistory.json";
import roster from "../data/roster.json";
import { cleanPlayerName, normalizePlayerName } from "./playerNames";

export type LootBucketKey = "bis" | "major" | "minor" | "offspec" | "bonusRolls";

export interface LootTier {
  slug: string;
  label: string;
  shortLabel: string;
  instanceIncludes: string[];
  showArchiveNav: boolean;
}

export interface LootHistoryRow {
  date: string;
  player: string;
  realm?: string;
  characterRealm?: string;
  item: string;
  boss: string;
  instance: string;
  type: string;
}

export interface LootSummaryRow {
  player: string;
  realm?: string;
  characterRealm?: string;
  bis: number;
  major: number;
  minor: number;
  offspec: number;
  bonusRolls: number;
  total: number;
  activeRoster: boolean;
}

export interface LootTimelinePoint {
  weekStart: string;
  label: string;
  bis: number;
  major: number;
  minor: number;
  offspec: number;
  bonusRolls: number;
}

interface RosterRow {
  character: string;
}

export const currentLootTierSlug = "siege-of-orgrimmar";

export const lootTiers: LootTier[] = [
  {
    slug: "siege-of-orgrimmar",
    label: "Siege of Orgrimmar",
    shortLabel: "SoO",
    instanceIncludes: ["Siege of Orgrimmar"],
    showArchiveNav: false,
  },
  {
    slug: "throne-of-thunder",
    label: "Throne of Thunder",
    shortLabel: "ToT",
    instanceIncludes: ["Throne of Thunder"],
    showArchiveNav: true,
  },
];

export const lootBucketLabels: Record<LootBucketKey, string> = {
  bis: "BiS",
  major: "Major",
  minor: "Minor",
  offspec: "Offspec",
  bonusRolls: "Bonus Rolls",
};

export const lootBucketColors: Record<LootBucketKey, string> = {
  bis: "#d8bb73",
  major: "#6fcf97",
  minor: "#74a7f2",
  offspec: "#ee9a8e",
  bonusRolls: "#b997f7",
};

const getLootHistoryKey = (row: LootHistoryRow) =>
  [
    row.date,
    normalizePlayerName(row.player),
    row.characterRealm ?? "",
    row.item,
    row.boss,
    row.instance,
    row.type,
  ].join("|");

const liveLootHistoryRows = lootHistory as LootHistoryRow[];
const liveLootHistoryKeys = new Set(liveLootHistoryRows.map(getLootHistoryKey));
const archivedLootHistoryRows = (archivedThroneOfThunderLootHistory as LootHistoryRow[]).filter(
  (row) => !liveLootHistoryKeys.has(getLootHistoryKey(row)),
);

export const allLootHistoryRows = [...archivedLootHistoryRows, ...liveLootHistoryRows];
const rosterRows = roster as RosterRow[];
const activeRosterNames = new Set(rosterRows.map((row) => normalizePlayerName(row.character)));
const currentLootTier = lootTiers.find((tier) => tier.slug === currentLootTierSlug) ?? lootTiers[0];

const normalizeText = (value: string) => value.trim().toLocaleLowerCase();
const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const getWeekStart = (isoDate: string) => {
  const date = parseIsoDate(isoDate);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()));
};
const addWeeks = (weekStart: string, weeks: number) => {
  const date = parseIsoDate(weekStart);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + weeks * 7));
};
const formatWeekLabel = (weekStart: string) => {
  const date = parseIsoDate(weekStart);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};
const getEmptyLootBuckets = (): Record<LootBucketKey, number> => ({
  bis: 0,
  major: 0,
  minor: 0,
  offspec: 0,
  bonusRolls: 0,
});

const getEmptySummary = (player: string, award?: LootHistoryRow): LootSummaryRow => ({
  player,
  realm: award?.realm ?? "",
  characterRealm: award?.characterRealm ?? player,
  bis: 0,
  major: 0,
  minor: 0,
  offspec: 0,
  bonusRolls: 0,
  total: 0,
  activeRoster: activeRosterNames.has(normalizePlayerName(player)),
});

export const getLootTierBySlug = (slug?: string | null) =>
  lootTiers.find((tier) => tier.slug === slug) ?? currentLootTier;

export const getCurrentLootTier = () => currentLootTier;

export const getArchivedLootTiers = () =>
  lootTiers.filter((tier) => tier.slug !== currentLootTierSlug && tier.showArchiveNav);

export const getLootSummaryHref = (tier: LootTier) =>
  tier.slug === currentLootTierSlug ? "/loot" : `/loot/archive/${tier.slug}`;

export const getLootHistoryHref = (tier: LootTier) =>
  tier.slug === currentLootTierSlug ? "/loot/history" : `/loot/history/${tier.slug}`;

export const getLootTierForAward = (award: LootHistoryRow) =>
  lootTiers.find((tier) =>
    tier.instanceIncludes.some((matchText) => normalizeText(award.instance).includes(normalizeText(matchText))),
  );

export const getLootAwardsForTier = (tierSlug = currentLootTierSlug) => {
  const tier = getLootTierBySlug(tierSlug);

  return allLootHistoryRows
    .filter((award) => getLootTierForAward(award)?.slug === tier.slug)
    .map((award) => ({ ...award, player: cleanPlayerName(award.player) }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const getLootBucket = (type: string): LootBucketKey | null => {
  const normalized = normalizeText(type).replace(/[^a-z0-9]+/g, " ");

  if (normalized === "best in slot") {
    return "bis";
  }

  if (normalized === "major upgrade") {
    return "major";
  }

  if (normalized === "minor upgrade") {
    return "minor";
  }

  if (normalized === "off spec" || normalized === "offspec") {
    return "offspec";
  }

  if (normalized === "bonus loot" || normalized === "bonus roll" || normalized === "bonus rolls") {
    return "bonusRolls";
  }

  return null;
};

export const countsTowardTierLootTotal = (type: string) => {
  const bucket = getLootBucket(type);
  return bucket === "bis" || bucket === "major" || bucket === "minor";
};

export const buildLootSummary = (awards: LootHistoryRow[]) => {
  const summaries = new Map<string, LootSummaryRow>();

  for (const award of awards) {
    const player = cleanPlayerName(award.player);
    const normalized = normalizePlayerName(player);
    const summary = summaries.get(normalized) ?? getEmptySummary(player, award);
    const bucket = getLootBucket(award.type);

    if (bucket) {
      summary[bucket] += 1;
    }

    summary.total = summary.bis + summary.major + summary.minor;
    summaries.set(normalized, summary);
  }

  return [...summaries.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.bis - a.bis ||
      a.player.localeCompare(b.player, undefined, { sensitivity: "base" }),
  );
};

export const getLootSummaryForTier = (tierSlug = currentLootTierSlug) =>
  buildLootSummary(getLootAwardsForTier(tierSlug));

export const getPlayerLootSummaryForTier = (playerName: string, tierSlug = currentLootTierSlug) => {
  const normalized = normalizePlayerName(playerName);
  return (
    getLootSummaryForTier(tierSlug).find((row) => normalizePlayerName(row.player) === normalized) ??
    getEmptySummary(cleanPlayerName(playerName))
  );
};

export const getPlayerLootAwardsForTier = (playerName: string, tierSlug = currentLootTierSlug) => {
  const normalized = normalizePlayerName(playerName);
  return getLootAwardsForTier(tierSlug).filter((award) => normalizePlayerName(award.player) === normalized);
};

export const getPlayerLootTimeline = (playerName: string, tierSlug = currentLootTierSlug, weekLimit = 26) => {
  const tierAwards = getLootAwardsForTier(tierSlug).sort((a, b) => a.date.localeCompare(b.date));
  const normalizedPlayerName = normalizePlayerName(playerName);
  const playerAwards = tierAwards.filter((award) => normalizePlayerName(award.player) === normalizedPlayerName);
  const weeklyBuckets = new Map<string, Record<LootBucketKey, number>>();

  if (tierAwards.length === 0) {
    return [];
  }

  for (const award of playerAwards) {
    const bucket = getLootBucket(award.type);

    if (!bucket) {
      continue;
    }

    const weekStart = getWeekStart(award.date);
    const week = weeklyBuckets.get(weekStart) ?? getEmptyLootBuckets();
    week[bucket] += 1;
    weeklyBuckets.set(weekStart, week);
  }

  const firstWeek = getWeekStart(tierAwards[0].date);
  const lastWeek = getWeekStart(tierAwards[tierAwards.length - 1].date);
  const tierWeeks: string[] = [];

  for (let weekStart = firstWeek; weekStart <= lastWeek; weekStart = addWeeks(weekStart, 1)) {
    tierWeeks.push(weekStart);
    if (tierWeeks.length > weekLimit) {
      tierWeeks.shift();
    }
  }

  return tierWeeks.map((weekStart): LootTimelinePoint => {
    const week = weeklyBuckets.get(weekStart) ?? getEmptyLootBuckets();
    return {
      weekStart,
      label: formatWeekLabel(weekStart),
      bis: week.bis,
      major: week.major,
      minor: week.minor,
      offspec: week.offspec,
      bonusRolls: week.bonusRolls,
    };
  });
};
