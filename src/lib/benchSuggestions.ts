import benchRulesJson from "../data/benchRules.json";
import {
  activeRosterPlayers,
  benchSummaries,
  getTodayIso,
  parseIsoDate,
  raidNights,
  type Player,
  type RaidNight,
  type StatusPlayer,
} from "./guildData";
import { getGearNeedsReport, type BossGearNeed, type PlayerBossGearStatus } from "./gearNeeds";
import { getRaidBuffCoverage } from "./raidBuffs";

const DEFAULT_BENCH_SUGGESTION_WINDOW_WEEKS = 8;
const TARGET_RAID_SIZE = 25;
const RECENT_BENCH_DAYS = 21;
const RECENT_UNAVAILABLE_WEEK_LOOKBACK = 2;
const MIN_RECENT_UNAVAILABLE_PENALTY = -20;
const MIN_ADJACENT_UNAVAILABLE_PENALTY = -30;

interface BenchRules {
  neverBenchPlayers: string[];
  avoidBenchingTogether: [string, string][];
  minimumAvailableByRole: Record<string, number>;
  minimumAvailableByClass: Record<string, number>;
  requireAtLeastOneAvailablePerClass: boolean;
  minimumAvailablePerClass?: number;
  planningWindowWeeks?: number;
  scoring: {
    lowBenchCountWeight: number;
    notRecentlyBenchedWeight: number;
    backToBackBenchPenalty: number;
    recentlyUnavailablePenalty?: number;
    adjacentUnavailablePenalty?: number;
  };
  source: "sheet" | "fallback";
}

interface BenchCandidate {
  player: Player;
  score: number;
  reasons: string[];
  suggestedCount: number;
  totalBenchCount: number;
  daysSinceBench: number;
  hasRecentUnavailablePenalty: boolean;
  hasAdjacentUnavailablePenalty: boolean;
}

interface PlanningState {
  suggestedWeekKeysBySlug: Map<string, Set<string>>;
  suggestedCountBySlug: Map<string, number>;
}

interface BossPlanningState {
  suggestedCountBySlug: Map<string, number>;
  lastSuggestedBossOrderBySlug: Map<string, number>;
}

export interface BenchSuggestionWeek {
  label: string;
  rosterSize: number;
  unavailablePlayers: StatusPlayer[];
  requiredBenchCount: number;
  existingBenchPlayers: StatusPlayer[];
  suggestedBenchPlayers: StatusPlayer[];
  status: string;
  notes: string[];
  warnings: string[];
}

export interface BossBenchSuggestionPlayer extends StatusPlayer {
  reasons: string[];
}

export interface BossBenchSuggestion {
  bossName: string;
  order: number;
  rosterSize: number;
  unavailablePlayers: StatusPlayer[];
  requiredBenchCount: number;
  existingBenchPlayers: StatusPlayer[];
  suggestedBenchPlayers: BossBenchSuggestionPlayer[];
  status: string;
  notes: string[];
  warnings: string[];
}

const benchRules = benchRulesJson as unknown as BenchRules;
const MINIMUM_HEALERS = 5;
const effectiveMinimumAvailableByRole = {
  ...benchRules.minimumAvailableByRole,
  Healer: Math.max(benchRules.minimumAvailableByRole.Healer ?? 0, MINIMUM_HEALERS),
};
export const BENCH_SUGGESTION_WINDOW_WEEKS =
  benchRules.planningWindowWeeks && benchRules.planningWindowWeeks >= 1
    ? Math.floor(benchRules.planningWindowWeeks)
    : DEFAULT_BENCH_SUGGESTION_WINDOW_WEEKS;
const benchSummaryBySlug = new Map(benchSummaries.map((summary) => [summary.playerSlug, summary]));
const activeRosterBySlug = new Map(activeRosterPlayers.map((player) => [player.slug, player]));
const maxBenchCount = Math.max(0, ...benchSummaries.map((summary) => summary.totalScheduledBenchNights));

const getWeekStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatShortDate = (isoDate: string) =>
  parseIsoDate(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const formatWeekDateRange = (nights: RaidNight[]) => {
  const firstNight = nights[0];
  const lastNight = nights[nights.length - 1];

  if (!firstNight || !lastNight) {
    return "No raid dates";
  }

  return firstNight.isoDate === lastNight.isoDate
    ? formatShortDate(firstNight.isoDate)
    : `${formatShortDate(firstNight.isoDate)} - ${formatShortDate(lastNight.isoDate)}`;
};
const normalizeKey = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
const sortStatusPlayers = (players: StatusPlayer[]) =>
  [...players].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
const playerList = (players: StatusPlayer[]) => (players.length > 0 ? players.map((player) => player.name).join(", ") : "None");
const getEffectivePenalty = (weight: number | undefined, minimumPenalty: number) => {
  if (!weight) {
    return 0;
  }

  const penalty = weight > 0 ? -weight : weight;
  return Math.min(penalty, minimumPenalty);
};

const getUniquePlayers = (playerLists: StatusPlayer[][]) => {
  const bySlug = new Map<string, StatusPlayer>();

  for (const players of playerLists) {
    for (const player of players) {
      bySlug.set(player.slug, player);
    }
  }

  return sortStatusPlayers([...bySlug.values()]);
};

const getFutureRaidWeeks = (todayIso = getTodayIso()) => {
  const futureNights = raidNights.filter((night) => night.isoDate >= todayIso);
  const weekKeys: string[] = [];

  for (const night of futureNights) {
    const weekKey = toIsoDate(getWeekStart(parseIsoDate(night.isoDate)));

    if (!weekKeys.includes(weekKey)) {
      weekKeys.push(weekKey);
    }

    if (weekKeys.length === BENCH_SUGGESTION_WINDOW_WEEKS) {
      break;
    }
  }

  return weekKeys.map((weekKey) => ({
    weekKey,
    nights: futureNights.filter((night) => toIsoDate(getWeekStart(parseIsoDate(night.isoDate))) === weekKey),
  }));
};

const getPlayerBenchWeekKeys = (playerSlug: string) =>
  new Set(
    raidNights
      .filter((night) => night.bench.some((player) => player.slug === playerSlug))
      .map((night) => toIsoDate(getWeekStart(parseIsoDate(night.isoDate)))),
  );

const createPlanningState = (): PlanningState => ({
  suggestedWeekKeysBySlug: new Map(),
  suggestedCountBySlug: new Map(),
});

const createBossPlanningState = (): BossPlanningState => ({
  suggestedCountBySlug: new Map(),
  lastSuggestedBossOrderBySlug: new Map(),
});

const addSuggestedBenchToPlanningState = (planningState: PlanningState, playerSlug: string, weekKey: string) => {
  const weekKeys = planningState.suggestedWeekKeysBySlug.get(playerSlug) ?? new Set<string>();
  weekKeys.add(weekKey);
  planningState.suggestedWeekKeysBySlug.set(playerSlug, weekKeys);
  planningState.suggestedCountBySlug.set(playerSlug, (planningState.suggestedCountBySlug.get(playerSlug) ?? 0) + 1);
};

const addSuggestedBossBenchToPlanningState = (
  planningState: BossPlanningState,
  playerSlug: string,
  bossOrder: number,
) => {
  planningState.suggestedCountBySlug.set(playerSlug, (planningState.suggestedCountBySlug.get(playerSlug) ?? 0) + 1);
  planningState.lastSuggestedBossOrderBySlug.set(playerSlug, bossOrder);
};

const getSuggestedBenchWeekKeys = (playerSlug: string, planningState: PlanningState) =>
  planningState.suggestedWeekKeysBySlug.get(playerSlug) ?? new Set<string>();

const getCombinedBenchWeekKeys = (playerSlug: string, planningState: PlanningState) =>
  new Set([...getPlayerBenchWeekKeys(playerSlug), ...getSuggestedBenchWeekKeys(playerSlug, planningState)]);

const getAdjacentWeekKeys = (weekKey: string) => {
  const weekStart = parseIsoDate(weekKey);
  const previousWeek = new Date(weekStart);
  const nextWeek = new Date(weekStart);
  previousWeek.setDate(previousWeek.getDate() - 7);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [toIsoDate(previousWeek), toIsoDate(nextWeek)];
};

const hasUnavailableStatus = (night: RaidNight, playerSlug: string) =>
  [...night.out, ...night.late, ...night.mia].some((player) => player.slug === playerSlug);

const getWeekKeysBefore = (weekKey: string, count: number) => {
  const keys: string[] = [];
  const weekStart = parseIsoDate(weekKey);

  for (let index = 1; index <= count; index += 1) {
    const previousWeek = new Date(weekStart);
    previousWeek.setDate(previousWeek.getDate() - 7 * index);
    keys.push(toIsoDate(previousWeek));
  }

  return keys;
};

const hasUnavailableInWeek = (playerSlug: string, weekKey: string) =>
  raidNights.some(
    (night) =>
      toIsoDate(getWeekStart(parseIsoDate(night.isoDate))) === weekKey &&
      hasUnavailableStatus(night, playerSlug),
  );

const wasRecentlyUnavailable = (playerSlug: string, weekKey: string) =>
  getWeekKeysBefore(weekKey, RECENT_UNAVAILABLE_WEEK_LOOKBACK).some((previousWeekKey) =>
    hasUnavailableInWeek(playerSlug, previousWeekKey),
  );

const hasAdjacentUnavailable = (playerSlug: string, weekKey: string) =>
  getAdjacentWeekKeys(weekKey).some((adjacentWeekKey) => hasUnavailableInWeek(playerSlug, adjacentWeekKey));

const getLastBenchWeekKey = (playerSlug: string, weekKey: string, planningState: PlanningState) => {
  const currentWeekTime = parseIsoDate(weekKey).getTime();
  const previousBenchWeekKeys = [...getCombinedBenchWeekKeys(playerSlug, planningState)].filter(
    (benchWeekKey) => parseIsoDate(benchWeekKey).getTime() < currentWeekTime,
  );

  return previousBenchWeekKeys.sort((a, b) => b.localeCompare(a))[0] ?? "";
};

const getDaysSinceBench = (playerSlug: string, weekKey: string, planningState: PlanningState) => {
  const lastBenchWeekKey = getLastBenchWeekKey(playerSlug, weekKey, planningState);

  if (!lastBenchWeekKey) {
    return Number.POSITIVE_INFINITY;
  }

  return (parseIsoDate(weekKey).getTime() - parseIsoDate(lastBenchWeekKey).getTime()) / (1000 * 60 * 60 * 24);
};

const wasBenchedRecently = (playerSlug: string, weekKey: string, planningState: PlanningState) => {
  const daysSinceBench = getDaysSinceBench(playerSlug, weekKey, planningState);
  return Number.isFinite(daysSinceBench) && daysSinceBench >= 0 && daysSinceBench < RECENT_BENCH_DAYS;
};

const hasAdjacentBench = (playerSlug: string, weekKey: string, planningState: PlanningState) => {
  const playerBenchWeeks = getCombinedBenchWeekKeys(playerSlug, planningState);
  return getAdjacentWeekKeys(weekKey).some((adjacentWeekKey) => playerBenchWeeks.has(adjacentWeekKey));
};

const hasAdjacentSuggestedBench = (playerSlug: string, weekKey: string, planningState: PlanningState) => {
  const playerSuggestedWeeks = getSuggestedBenchWeekKeys(playerSlug, planningState);
  return getAdjacentWeekKeys(weekKey).some((adjacentWeekKey) => playerSuggestedWeeks.has(adjacentWeekKey));
};

const getAvailableCounts = (unavailableSlugs: Set<string>, benchSlugs: Set<string>) => {
  const byRole = new Map<string, number>();
  const byClass = new Map<string, number>();

  for (const player of activeRosterPlayers) {
    if (unavailableSlugs.has(player.slug) || benchSlugs.has(player.slug)) {
      continue;
    }

    const roleKey = normalizeKey(player.role);
    const classKey = normalizeKey(player.className);
    byRole.set(roleKey, (byRole.get(roleKey) ?? 0) + 1);
    byClass.set(classKey, (byClass.get(classKey) ?? 0) + 1);
  }

  return { byRole, byClass };
};

const getRaidReadyPlayers = (unavailableSlugs: Set<string>, benchSlugs: Set<string>) =>
  activeRosterPlayers.filter((player) => !unavailableSlugs.has(player.slug) && !benchSlugs.has(player.slug));

const getMissingRaidBuffs = (unavailableSlugs: Set<string>, benchSlugs: Set<string>) =>
  getRaidBuffCoverage(getRaidReadyPlayers(unavailableSlugs, benchSlugs)).missing;

const getNewMissingRaidBuffs = (
  unavailableSlugs: Set<string>,
  currentBenchSlugs: Set<string>,
  projectedBenchSlugs: Set<string>,
) => {
  const currentMissing = new Set(getMissingRaidBuffs(unavailableSlugs, currentBenchSlugs));

  return getMissingRaidBuffs(unavailableSlugs, projectedBenchSlugs).filter((buff) => !currentMissing.has(buff));
};

const getConstraintWarnings = (benchSlugs: Set<string>, unavailableSlugs: Set<string>) => {
  const warnings: string[] = [];

  for (const playerSlug of benchRules.neverBenchPlayers) {
    if (benchSlugs.has(playerSlug)) {
      warnings.push(
        `Existing plan violates never-bench rule: ${activeRosterBySlug.get(playerSlug)?.name ?? playerSlug} is benched. Review manually.`,
      );
    }
  }

  for (const [firstPlayer, secondPlayer] of benchRules.avoidBenchingTogether) {
    if (benchSlugs.has(firstPlayer) && benchSlugs.has(secondPlayer)) {
      const firstName = activeRosterBySlug.get(firstPlayer)?.name ?? firstPlayer;
      const secondName = activeRosterBySlug.get(secondPlayer)?.name ?? secondPlayer;
      warnings.push(`Existing plan violates avoid-together rule: ${firstName} and ${secondName} are both benched. Review manually.`);
    }
  }

  const counts = getAvailableCounts(unavailableSlugs, benchSlugs);

  for (const [role, minimum] of Object.entries(effectiveMinimumAvailableByRole)) {
    const available = counts.byRole.get(normalizeKey(role)) ?? 0;

    if (available < minimum) {
      const roleLabel = role.toLocaleLowerCase();
      const availableLabel = normalizeKey(role) === "healer" ? "available healers" : `available ${role} count`;
      warnings.push(
        `Existing plan violates ${roleLabel} minimum: ${availableLabel} would be ${available}, rule requires ${minimum}. Review manually.`,
      );
    }
  }

  for (const [className, minimum] of Object.entries(benchRules.minimumAvailableByClass)) {
    const available = counts.byClass.get(normalizeKey(className)) ?? 0;

    if (available < minimum) {
      warnings.push(
        `Existing plan violates class minimum: available ${className} count would be ${available}, rule requires ${minimum}. Review manually.`,
      );
    }
  }

  if (benchRules.requireAtLeastOneAvailablePerClass) {
    const minimum = benchRules.minimumAvailablePerClass ?? 1;
    const rosterClasses = [...new Set(activeRosterPlayers.map((player) => player.className))];

    for (const className of rosterClasses) {
      const available = counts.byClass.get(normalizeKey(className)) ?? 0;

      if (available < minimum) {
        warnings.push(
          `Existing plan violates class minimum: available ${className} count would be ${available}, rule requires ${minimum}. Review manually.`,
        );
      }
    }
  }

  return warnings;
};

const passesHardRules = (player: Player, unavailableSlugs: Set<string>, benchSlugs: Set<string>) => {
  if (unavailableSlugs.has(player.slug) || benchSlugs.has(player.slug) || benchRules.neverBenchPlayers.includes(player.slug)) {
    return false;
  }

  const nextBenchSlugs = new Set(benchSlugs);
  nextBenchSlugs.add(player.slug);

  for (const [firstPlayer, secondPlayer] of benchRules.avoidBenchingTogether) {
    const alreadyViolated = benchSlugs.has(firstPlayer) && benchSlugs.has(secondPlayer);
    const wouldViolate = nextBenchSlugs.has(firstPlayer) && nextBenchSlugs.has(secondPlayer);

    if (wouldViolate && !alreadyViolated) {
      return false;
    }
  }

  const currentCounts = getAvailableCounts(unavailableSlugs, benchSlugs);
  const nextCounts = getAvailableCounts(unavailableSlugs, nextBenchSlugs);

  for (const [role, minimum] of Object.entries(effectiveMinimumAvailableByRole)) {
    const roleKey = normalizeKey(role);
    const currentAvailable = currentCounts.byRole.get(roleKey) ?? 0;
    const nextAvailable = nextCounts.byRole.get(roleKey) ?? 0;

    if (nextAvailable < minimum && nextAvailable < currentAvailable) {
      return false;
    }
  }

  for (const [className, minimum] of Object.entries(benchRules.minimumAvailableByClass)) {
    const classKey = normalizeKey(className);
    const currentAvailable = currentCounts.byClass.get(classKey) ?? 0;
    const nextAvailable = nextCounts.byClass.get(classKey) ?? 0;

    if (nextAvailable < minimum && nextAvailable < currentAvailable) {
      return false;
    }
  }

  if (benchRules.requireAtLeastOneAvailablePerClass) {
    const minimum = benchRules.minimumAvailablePerClass ?? 1;
    const rosterClasses = [...new Set(activeRosterPlayers.map((rosterPlayer) => rosterPlayer.className))];

    for (const className of rosterClasses) {
      const classKey = normalizeKey(className);
      const currentAvailable = currentCounts.byClass.get(classKey) ?? 0;
      const nextAvailable = nextCounts.byClass.get(classKey) ?? 0;

      if (nextAvailable < minimum && nextAvailable < currentAvailable) {
        return false;
      }
    }
  }

  return true;
};

const getRaidBuffCandidateViolations = (player: Player, unavailableSlugs: Set<string>, benchSlugs: Set<string>) => {
  const nextBenchSlugs = new Set(benchSlugs);
  nextBenchSlugs.add(player.slug);

  return getNewMissingRaidBuffs(unavailableSlugs, benchSlugs, nextBenchSlugs);
};

const scoreCandidate = (player: Player, weekKey: string, planningState: PlanningState): BenchCandidate => {
  const summary = benchSummaryBySlug.get(player.slug);
  const suggestedCount = planningState.suggestedCountBySlug.get(player.slug) ?? 0;
  const totalBenchCount = (summary?.totalScheduledBenchNights ?? 0) + suggestedCount;
  const daysSinceBench = getDaysSinceBench(player.slug, weekKey, planningState);
  const reasons: string[] = [];
  const recentUnavailablePenalty = getEffectivePenalty(
    benchRules.scoring.recentlyUnavailablePenalty,
    MIN_RECENT_UNAVAILABLE_PENALTY,
  );
  const adjacentUnavailablePenalty = getEffectivePenalty(
    benchRules.scoring.adjacentUnavailablePenalty,
    MIN_ADJACENT_UNAVAILABLE_PENALTY,
  );
  const hasRecentUnavailablePenalty = Boolean(recentUnavailablePenalty && wasRecentlyUnavailable(player.slug, weekKey));
  const hasAdjacentUnavailablePenalty = Boolean(adjacentUnavailablePenalty && hasAdjacentUnavailable(player.slug, weekKey));
  let score = 0;

  if (benchRules.scoring.lowBenchCountWeight) {
    score += (maxBenchCount - totalBenchCount) * benchRules.scoring.lowBenchCountWeight;
    reasons.push(`lower bench count (${totalBenchCount})`);
  }

  if (suggestedCount === 0) {
    reasons.push("not suggested in this planning run");
  }

  if (benchRules.scoring.notRecentlyBenchedWeight && !wasBenchedRecently(player.slug, weekKey, planningState)) {
    score += Number.isFinite(daysSinceBench) ? benchRules.scoring.notRecentlyBenchedWeight : benchRules.scoring.notRecentlyBenchedWeight * 2;
    reasons.push(Number.isFinite(daysSinceBench) ? "not recently benched" : "no recent bench history");
  }

  if (benchRules.scoring.backToBackBenchPenalty && hasAdjacentBench(player.slug, weekKey, planningState)) {
    score += benchRules.scoring.backToBackBenchPenalty;
    reasons.push(
      hasAdjacentSuggestedBench(player.slug, weekKey, planningState)
        ? "penalized because they were suggested in an adjacent week"
        : "penalized for adjacent bench",
    );
  }

  if (hasRecentUnavailablePenalty) {
    score += recentUnavailablePenalty;
    reasons.push("penalized for recent Out/Late/MIA");
  }

  if (hasAdjacentUnavailablePenalty) {
    score += adjacentUnavailablePenalty;
    reasons.push("penalized for adjacent Out/Late/MIA");
  }

  return {
    player,
    score,
    reasons,
    suggestedCount,
    totalBenchCount,
    daysSinceBench,
    hasRecentUnavailablePenalty,
    hasAdjacentUnavailablePenalty,
  };
};

const compareDaysSinceBench = (a: BenchCandidate, b: BenchCandidate) => {
  if (a.daysSinceBench === b.daysSinceBench) {
    return 0;
  }

  if (!Number.isFinite(a.daysSinceBench)) {
    return -1;
  }

  if (!Number.isFinite(b.daysSinceBench)) {
    return 1;
  }

  return b.daysSinceBench - a.daysSinceBench;
};

const getStatusPlayer = (player: Player): StatusPlayer => ({
  slug: player.slug,
  name: player.name,
  className: player.className,
  href: player.href,
});

const getBossGearReason = (bossGearStatus: PlayerBossGearStatus | undefined) => {
  if (!bossGearStatus || bossGearStatus.targetCount === 0) {
    return {
      score: 220,
      reason: "no tracked BiS from this boss",
      lootNeeds: 0,
    };
  }

  if (bossGearStatus.status === "complete") {
    return {
      score: 240,
      reason: "already has tracked BiS from this boss",
      lootNeeds: 0,
    };
  }

  const neededItems = bossGearStatus.needs.map((need) => `${need.item} (${need.slot})`);

  return {
    score: -260 - neededItems.length * 60,
    reason:
      neededItems.length > 0
        ? `would miss ${neededItems.join("; ")}`
        : "still has tracked BiS from this boss",
    lootNeeds: neededItems.length,
  };
};

const scoreBossCandidate = (
  player: Player,
  weekKey: string,
  boss: BossGearNeed,
  bossGearStatus: PlayerBossGearStatus | undefined,
  weekPlanningState: PlanningState,
  bossPlanningState: BossPlanningState,
): BenchCandidate => {
  const candidate = scoreCandidate(player, weekKey, weekPlanningState);
  const bossSuggestedCount = bossPlanningState.suggestedCountBySlug.get(player.slug) ?? 0;
  const lastSuggestedBossOrder = bossPlanningState.lastSuggestedBossOrderBySlug.get(player.slug) ?? 0;
  const gearReason = getBossGearReason(bossGearStatus);
  candidate.score += gearReason.score;
  candidate.score -= bossSuggestedCount * 180;

  if (lastSuggestedBossOrder === boss.order - 1) {
    candidate.score -= 90;
    candidate.reasons.push("penalized for sitting the previous boss");
  }

  candidate.reasons.unshift(gearReason.reason);

  if (bossSuggestedCount === 0) {
    candidate.reasons.push("not already sat in this boss plan");
  } else {
    candidate.reasons.push(`already sat ${bossSuggestedCount} boss${bossSuggestedCount === 1 ? "" : "es"} in this boss plan`);
  }

  if (gearReason.lootNeeds > 0) {
    candidate.reasons.push("loot penalty applied");
  }

  return candidate;
};

const getPrimaryPlanningWeek = (todayIso = getTodayIso()) => {
  const [planningWeek] = getFutureRaidWeeks(todayIso);
  return planningWeek ?? { weekKey: todayIso, nights: [] };
};

export const getBenchSuggestionWeeks = (todayIso = getTodayIso()): BenchSuggestionWeek[] => {
  const weeks = getFutureRaidWeeks(todayIso);
  const planningState = createPlanningState();
  const suggestionWeeks: BenchSuggestionWeek[] = [];

  for (const { weekKey, nights } of weeks) {
    const unavailablePlayers = getUniquePlayers(nights.map((night) => [...night.out, ...night.late, ...night.mia]));
    const existingBenchPlayers = getUniquePlayers(nights.map((night) => night.bench));
    const unavailableSlugs = new Set(unavailablePlayers.map((player) => player.slug));
    const existingBenchSlugs = new Set(existingBenchPlayers.map((player) => player.slug));
    const activeRosterSize = activeRosterPlayers.length;
    const availableRaiders = activeRosterSize - unavailableSlugs.size;
    const requiredBenchCount = Math.max(0, availableRaiders - TARGET_RAID_SIZE);
    const additionalBenchNeeded = Math.max(0, requiredBenchCount - existingBenchSlugs.size);
    const suggestedBenchPlayers: StatusPlayer[] = [];
    const suggestedBenchSlugs = new Set<string>();
    const warnings: string[] = [];
    const notes: string[] = [];

    if (availableRaiders < TARGET_RAID_SIZE) {
      warnings.push(`Raid is short by ${TARGET_RAID_SIZE - availableRaiders} before benching.`);
    }

    for (const player of existingBenchPlayers) {
      if (unavailableSlugs.has(player.slug)) {
        warnings.push(`${player.name} is marked Bench and also Out/Late/MIA in this date range. Review manually.`);
      }
    }

    if (existingBenchSlugs.size > requiredBenchCount) {
      warnings.push(
        `Existing bench exceeds required bench by ${existingBenchSlugs.size - requiredBenchCount}. Review manually if you want to bring players back in.`,
      );
    }

    warnings.push(...getConstraintWarnings(existingBenchSlugs, unavailableSlugs));

    const existingMissingRaidBuffs = getMissingRaidBuffs(unavailableSlugs, existingBenchSlugs);

    if (existingMissingRaidBuffs.length > 0) {
      warnings.push(`Existing plan is missing raid buffs: ${existingMissingRaidBuffs.join(", ")}. Review manually.`);
    }

    if (additionalBenchNeeded > 0) {
      const selectedCandidates: BenchCandidate[] = [];
      let skippedHardRuleCount = 0;
      let skippedRaidBuffCount = 0;
      const skippedRaidBuffs = new Set<string>();
      const candidates = activeRosterPlayers
        .map((player) => scoreCandidate(player, weekKey, planningState))
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.suggestedCount - b.suggestedCount ||
            a.totalBenchCount - b.totalBenchCount ||
            compareDaysSinceBench(a, b) ||
            a.player.name.localeCompare(b.player.name, undefined, { sensitivity: "base" }),
        );

      for (const candidate of candidates) {
        if (suggestedBenchPlayers.length >= additionalBenchNeeded) {
          break;
        }

        const currentBenchSlugs = new Set([...existingBenchSlugs, ...suggestedBenchSlugs]);

        if (!passesHardRules(candidate.player, unavailableSlugs, currentBenchSlugs)) {
          skippedHardRuleCount += 1;
          continue;
        }

        const missingBuffs = getRaidBuffCandidateViolations(candidate.player, unavailableSlugs, currentBenchSlugs);

        if (missingBuffs.length > 0) {
          skippedRaidBuffCount += 1;
          missingBuffs.forEach((buff) => skippedRaidBuffs.add(buff));
          continue;
        }

        suggestedBenchPlayers.push(getStatusPlayer(candidate.player));
        suggestedBenchSlugs.add(candidate.player.slug);
        selectedCandidates.push(candidate);
      }

      if (suggestedBenchPlayers.length < additionalBenchNeeded) {
        if (skippedRaidBuffCount > 0) {
          warnings.push(
            `Could only suggest ${suggestedBenchPlayers.length} of ${additionalBenchNeeded} needed bench players without losing required raid buffs.`,
          );
          warnings.push(`Skipped candidates who would remove raid buff coverage: ${[...skippedRaidBuffs].join(", ")}.`);
        }

        warnings.push(
          "Could not suggest a full bench list for this week because too many players are unavailable or constraints would be violated.",
        );
        warnings.push("No valid bench suggestion found without violating constraints.");
      }

      if (selectedCandidates.length > 0) {
        const selectedWithoutRepeat = selectedCandidates.every((candidate) => candidate.suggestedCount === 0);
        notes.push(
          selectedWithoutRepeat
            ? "Selected players had low bench counts and were not already suggested in this planning run."
            : "Selected players were the highest-ranked valid candidates after bench count and rotation scoring.",
        );

        const penalizedSelectedCandidates = selectedCandidates.filter(
          (candidate) => candidate.hasRecentUnavailablePenalty || candidate.hasAdjacentUnavailablePenalty,
        );

        for (const candidate of penalizedSelectedCandidates) {
          const penaltyLabel =
            candidate.hasRecentUnavailablePenalty && candidate.hasAdjacentUnavailablePenalty
              ? "recent and adjacent Out/Late/MIA"
              : candidate.hasAdjacentUnavailablePenalty
                ? "adjacent Out/Late/MIA"
                : "recent Out/Late/MIA";
          notes.push(
            `${candidate.player.name} was selected despite a ${penaltyLabel} penalty because no higher-ranked valid candidates remained.`,
          );
        }

        if (penalizedSelectedCandidates.length > 0 && skippedHardRuleCount > 0) {
          notes.push("Some higher-ranked candidates were skipped due to healer/class minimum or other hard rules.");
        }

        if (skippedRaidBuffCount > 0) {
          notes.push("Some candidates were skipped because benching them would remove raid buff coverage.");
        } else if (existingMissingRaidBuffs.length === 0) {
          notes.push("Raid buffs preserved.");
        }
      }
    }

    const status =
      requiredBenchCount === 0
        ? "No bench needed"
        : existingBenchSlugs.size >= requiredBenchCount
          ? "Already planned"
          : suggestedBenchPlayers.length > 0
            ? "Needs review"
            : "No valid suggestion";

    if (existingBenchSlugs.size > 0 && suggestedBenchPlayers.length > 0) {
      notes.unshift("Existing bench assignments respected.");
    }

    for (const player of suggestedBenchPlayers) {
      addSuggestedBenchToPlanningState(planningState, player.slug, weekKey);
    }

    suggestionWeeks.push({
      label: formatWeekDateRange(nights),
      rosterSize: activeRosterSize,
      unavailablePlayers,
      requiredBenchCount,
      existingBenchPlayers,
      suggestedBenchPlayers,
      status,
      notes,
      warnings: [...new Set(warnings)],
    });
  }

  return suggestionWeeks;
};

export const getBossBenchSuggestions = (todayIso = getTodayIso()): BossBenchSuggestion[] => {
  const { weekKey, nights } = getPrimaryPlanningWeek(todayIso);
  const gearNeedsReport = getGearNeedsReport();
  const weekPlanningState = createPlanningState();
  const bossPlanningState = createBossPlanningState();
  const unavailablePlayers = getUniquePlayers(nights.map((night) => [...night.out, ...night.late, ...night.mia]));
  const calendarBenchPlayers = getUniquePlayers(nights.map((night) => night.bench));
  const unavailableSlugs = new Set(unavailablePlayers.map((player) => player.slug));
  const existingBenchSlugs = new Set<string>();
  const activeRosterSize = activeRosterPlayers.length;
  const availableRaiders = activeRosterSize - unavailableSlugs.size;
  const requiredBenchCount = Math.max(0, availableRaiders - TARGET_RAID_SIZE);
  const additionalBenchNeeded = requiredBenchCount;

  return gearNeedsReport.bosses.map((boss): BossBenchSuggestion => {
    const suggestedBenchPlayers: BossBenchSuggestionPlayer[] = [];
    const suggestedBenchSlugs = new Set<string>();
    const selectedCandidates: BenchCandidate[] = [];
    const warnings: string[] = [];
    const notes: string[] = [];

    if (availableRaiders < TARGET_RAID_SIZE) {
      warnings.push(`Raid is short by ${TARGET_RAID_SIZE - availableRaiders} before boss benching.`);
    }

    warnings.push(...getConstraintWarnings(existingBenchSlugs, unavailableSlugs));

    const existingMissingRaidBuffs = getMissingRaidBuffs(unavailableSlugs, existingBenchSlugs);

    if (existingMissingRaidBuffs.length > 0) {
      warnings.push(`Existing plan is missing raid buffs: ${existingMissingRaidBuffs.join(", ")}. Review manually.`);
    }

    if (additionalBenchNeeded > 0) {
      let skippedHardRuleCount = 0;
      let skippedRaidBuffCount = 0;
      const skippedRaidBuffs = new Set<string>();
      const bossGearBySlug = new Map(boss.players.map((player) => [player.slug, player]));
      const candidates = activeRosterPlayers
        .map((player) =>
          scoreBossCandidate(player, weekKey, boss, bossGearBySlug.get(player.slug), weekPlanningState, bossPlanningState),
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            (bossPlanningState.suggestedCountBySlug.get(a.player.slug) ?? 0) -
              (bossPlanningState.suggestedCountBySlug.get(b.player.slug) ?? 0) ||
            a.suggestedCount - b.suggestedCount ||
            a.totalBenchCount - b.totalBenchCount ||
            compareDaysSinceBench(a, b) ||
            a.player.name.localeCompare(b.player.name, undefined, { sensitivity: "base" }),
        );

      for (const candidate of candidates) {
        if (suggestedBenchPlayers.length >= additionalBenchNeeded) {
          break;
        }

        const currentBenchSlugs = new Set([...existingBenchSlugs, ...suggestedBenchSlugs]);

        if (!passesHardRules(candidate.player, unavailableSlugs, currentBenchSlugs)) {
          skippedHardRuleCount += 1;
          continue;
        }

        const missingBuffs = getRaidBuffCandidateViolations(candidate.player, unavailableSlugs, currentBenchSlugs);

        if (missingBuffs.length > 0) {
          skippedRaidBuffCount += 1;
          missingBuffs.forEach((buff) => skippedRaidBuffs.add(buff));
          continue;
        }

        suggestedBenchPlayers.push({
          ...getStatusPlayer(candidate.player),
          reasons: candidate.reasons,
        });
        suggestedBenchSlugs.add(candidate.player.slug);
        selectedCandidates.push(candidate);
      }

      if (suggestedBenchPlayers.length < additionalBenchNeeded) {
        if (skippedRaidBuffCount > 0) {
          warnings.push(
            `Could only suggest ${suggestedBenchPlayers.length} of ${additionalBenchNeeded} needed bench players without losing required raid buffs.`,
          );
          warnings.push(`Skipped candidates who would remove raid buff coverage: ${[...skippedRaidBuffs].join(", ")}.`);
        }

        warnings.push(
          "Could not suggest a full boss bench list because too many players are unavailable or constraints would be violated.",
        );
      }

      if (selectedCandidates.length > 0) {
        const selectedWithLootNeeds = selectedCandidates.filter((candidate) =>
          candidate.reasons.some((reason) => reason.startsWith("would miss ")),
        );

        notes.push(
          selectedWithLootNeeds.length === 0
            ? "Suggested players do not have open tracked BiS from this boss."
            : "Some selected players still have tracked BiS on this boss because no higher-ranked valid loot-safe candidates remained.",
        );

        if (skippedHardRuleCount > 0) {
          notes.push("Some candidates were skipped due to healer/class minimum or other hard rules.");
        }

        if (skippedRaidBuffCount > 0) {
          notes.push("Some candidates were skipped because benching them would remove raid buff coverage.");
        } else if (existingMissingRaidBuffs.length === 0) {
          notes.push("Raid buffs preserved.");
        }
      }
    }

    for (const player of suggestedBenchPlayers) {
      addSuggestedBossBenchToPlanningState(bossPlanningState, player.slug, boss.order);
      addSuggestedBenchToPlanningState(weekPlanningState, player.slug, weekKey);
    }

    const status =
      requiredBenchCount === 0
        ? "No bench needed"
        : existingBenchSlugs.size >= requiredBenchCount
          ? "Already planned"
          : suggestedBenchPlayers.length > 0
            ? "Needs review"
            : "No valid suggestion";

    if (calendarBenchPlayers.length > 0 && suggestedBenchPlayers.length > 0) {
      notes.unshift("Current calendar bench was not locked; boss suggestions are generated fresh for per-boss rotation.");
    }

    return {
      bossName: boss.bossName,
      order: boss.order,
      rosterSize: activeRosterSize,
      unavailablePlayers,
      requiredBenchCount,
      existingBenchPlayers: calendarBenchPlayers,
      suggestedBenchPlayers,
      status,
      notes,
      warnings: [...new Set(warnings)],
    };
  });
};

export const getBenchSuggestionText = (todayIso = getTodayIso()) => {
  const suggestions = getBenchSuggestionWeeks(todayIso);

  if (suggestions.length === 0) {
    return "Suggested Bench Plan\n\nNo upcoming raid dates found.";
  }

  const lines = ["Suggested Bench Plan", ""];

  for (const suggestion of suggestions) {
    lines.push(suggestion.label);
    lines.push(`Roster: ${suggestion.rosterSize}`);
    lines.push(`Unavailable: ${suggestion.unavailablePlayers.length}${suggestion.unavailablePlayers.length > 0 ? ` (${playerList(suggestion.unavailablePlayers)})` : ""}`);
    lines.push(`Required bench: ${suggestion.requiredBenchCount}`);
    lines.push(`Existing bench: ${playerList(suggestion.existingBenchPlayers)}`);
    lines.push(`Suggested additional bench: ${playerList(suggestion.suggestedBenchPlayers)}`);
    lines.push(`Status: ${suggestion.status}`);

    if (suggestion.notes.length > 0) {
      lines.push("Notes:");
      lines.push(...suggestion.notes.map((note) => `- ${note}`));
    }

    if (suggestion.warnings.length > 0) {
      lines.push("Warnings:");
      lines.push(...suggestion.warnings.map((warning) => `- ${warning}`));
    }

    lines.push("");
  }

  lines.push(`Rules source: ${benchRules.source}`);
  lines.push(`Planning window weeks: ${BENCH_SUGGESTION_WINDOW_WEEKS}`);
  return lines.join("\n").trim();
};

export const getBossBenchSuggestionText = (todayIso = getTodayIso()) => {
  const suggestions = getBossBenchSuggestions(todayIso);

  if (suggestions.length === 0) {
    return "Boss Bench Suggestions\n\nNo Siege of Orgrimmar bosses found.";
  }

  const lines = ["Boss Bench Suggestions", ""];
  const firstSuggestion = suggestions[0];

  if (firstSuggestion) {
    lines.push(`Roster: ${firstSuggestion.rosterSize}`);
    lines.push(
      `Unavailable: ${firstSuggestion.unavailablePlayers.length}${
        firstSuggestion.unavailablePlayers.length > 0 ? ` (${playerList(firstSuggestion.unavailablePlayers)})` : ""
      }`,
    );
    lines.push(`Required bench per boss: ${firstSuggestion.requiredBenchCount}`);
    lines.push(`Current calendar bench (not locked): ${playerList(firstSuggestion.existingBenchPlayers)}`);
    lines.push("");
  }

  for (const suggestion of suggestions) {
    lines.push(`${suggestion.order}. ${suggestion.bossName}`);
    lines.push(`Suggested boss bench: ${playerList(suggestion.suggestedBenchPlayers)}`);
    lines.push(`Status: ${suggestion.status}`);

    if (suggestion.suggestedBenchPlayers.length > 0) {
      lines.push("Why:");

      for (const player of suggestion.suggestedBenchPlayers) {
        lines.push(`- ${player.name}: ${player.reasons.slice(0, 3).join("; ")}`);
      }
    }

    if (suggestion.notes.length > 0) {
      lines.push("Notes:");
      lines.push(...suggestion.notes.map((note) => `- ${note}`));
    }

    if (suggestion.warnings.length > 0) {
      lines.push("Warnings:");
      lines.push(...suggestion.warnings.map((warning) => `- ${warning}`));
    }

    lines.push("");
  }

  lines.push(`Rules source: ${benchRules.source}`);
  lines.push("Loot source: Officer BiS lists and guild loot history");
  return lines.join("\n").trim();
};
