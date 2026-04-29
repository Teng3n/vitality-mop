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

export const BENCH_SUGGESTION_WINDOW_WEEKS = 8;
const TARGET_RAID_SIZE = 25;
const RECENT_BENCH_DAYS = 21;

interface BenchRules {
  neverBenchPlayers: string[];
  avoidBenchingTogether: [string, string][];
  minimumAvailableByRole: Record<string, number>;
  minimumAvailableByClass: Record<string, number>;
  requireAtLeastOneAvailablePerClass: boolean;
  minimumAvailablePerClass?: number;
  scoring: {
    lowBenchCountWeight: number;
    notRecentlyBenchedWeight: number;
    backToBackBenchPenalty: number;
  };
  source: "sheet" | "fallback";
}

interface BenchCandidate {
  player: Player;
  score: number;
  reasons: string[];
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

const benchRules = benchRulesJson as unknown as BenchRules;
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
const formatRuleList = (values: string[]) => values.join(", ");

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

const getAdjacentWeekKeys = (weekKey: string) => {
  const weekStart = parseIsoDate(weekKey);
  const previousWeek = new Date(weekStart);
  const nextWeek = new Date(weekStart);
  previousWeek.setDate(previousWeek.getDate() - 7);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [toIsoDate(previousWeek), toIsoDate(nextWeek)];
};

const wasBenchedRecently = (playerSlug: string, weekKey: string) => {
  const summary = benchSummaryBySlug.get(playerSlug);

  if (!summary?.lastBenched) {
    return false;
  }

  const currentWeek = parseIsoDate(weekKey).getTime();
  const lastBench = parseIsoDate(summary.lastBenched.isoDate).getTime();
  const daysSinceLastBench = (currentWeek - lastBench) / (1000 * 60 * 60 * 24);

  return daysSinceLastBench >= 0 && daysSinceLastBench < RECENT_BENCH_DAYS;
};

const hasAdjacentBench = (playerSlug: string, weekKey: string) => {
  const playerBenchWeeks = getPlayerBenchWeekKeys(playerSlug);
  return getAdjacentWeekKeys(weekKey).some((adjacentWeekKey) => playerBenchWeeks.has(adjacentWeekKey));
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

const getConstraintWarnings = (benchSlugs: Set<string>, unavailableSlugs: Set<string>) => {
  const warnings: string[] = [];

  for (const playerSlug of benchRules.neverBenchPlayers) {
    if (benchSlugs.has(playerSlug)) {
      warnings.push(`Existing bench assignment violates NEVER_BENCH_PLAYER for ${activeRosterBySlug.get(playerSlug)?.name ?? playerSlug}.`);
    }
  }

  for (const [firstPlayer, secondPlayer] of benchRules.avoidBenchingTogether) {
    if (benchSlugs.has(firstPlayer) && benchSlugs.has(secondPlayer)) {
      const firstName = activeRosterBySlug.get(firstPlayer)?.name ?? firstPlayer;
      const secondName = activeRosterBySlug.get(secondPlayer)?.name ?? secondPlayer;
      warnings.push(`Existing bench assignment violates AVOID_BENCH_TOGETHER for ${firstName} and ${secondName}.`);
    }
  }

  const counts = getAvailableCounts(unavailableSlugs, benchSlugs);

  for (const [role, minimum] of Object.entries(benchRules.minimumAvailableByRole)) {
    const available = counts.byRole.get(normalizeKey(role)) ?? 0;

    if (available < minimum) {
      warnings.push(`Available ${role} count would be ${available}, below the rule minimum of ${minimum}.`);
    }
  }

  for (const [className, minimum] of Object.entries(benchRules.minimumAvailableByClass)) {
    const available = counts.byClass.get(normalizeKey(className)) ?? 0;

    if (available < minimum) {
      warnings.push(`Available ${className} count would be ${available}, below the rule minimum of ${minimum}.`);
    }
  }

  if (benchRules.requireAtLeastOneAvailablePerClass) {
    const minimum = benchRules.minimumAvailablePerClass ?? 1;
    const rosterClasses = [...new Set(activeRosterPlayers.map((player) => player.className))];

    for (const className of rosterClasses) {
      const available = counts.byClass.get(normalizeKey(className)) ?? 0;

      if (available < minimum) {
        warnings.push(`Available ${className} count would be ${available}, below the per-class minimum of ${minimum}.`);
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
    if (nextBenchSlugs.has(firstPlayer) && nextBenchSlugs.has(secondPlayer)) {
      return false;
    }
  }

  return getConstraintWarnings(nextBenchSlugs, unavailableSlugs).length === 0;
};

const scoreCandidate = (player: Player, weekKey: string): BenchCandidate => {
  const summary = benchSummaryBySlug.get(player.slug);
  const totalBenchCount = summary?.totalScheduledBenchNights ?? 0;
  const reasons: string[] = [];
  let score = 0;

  if (benchRules.scoring.lowBenchCountWeight) {
    score += (maxBenchCount - totalBenchCount) * benchRules.scoring.lowBenchCountWeight;
    reasons.push(`lower bench count (${totalBenchCount})`);
  }

  if (benchRules.scoring.notRecentlyBenchedWeight && !wasBenchedRecently(player.slug, weekKey)) {
    score += summary?.lastBenched ? benchRules.scoring.notRecentlyBenchedWeight : benchRules.scoring.notRecentlyBenchedWeight * 2;
    reasons.push(summary?.lastBenched ? "not recently benched" : "no recent bench history");
  }

  if (benchRules.scoring.backToBackBenchPenalty && hasAdjacentBench(player.slug, weekKey)) {
    score += benchRules.scoring.backToBackBenchPenalty;
  }

  return { player, score, reasons };
};

const getStatusPlayer = (player: Player): StatusPlayer => ({
  slug: player.slug,
  name: player.name,
  className: player.className,
  href: player.href,
});

export const getBenchSuggestionWeeks = (todayIso = getTodayIso()): BenchSuggestionWeek[] => {
  const weeks = getFutureRaidWeeks(todayIso);

  return weeks.map(({ weekKey, nights }) => {
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

    if (additionalBenchNeeded > 0) {
      const candidates = activeRosterPlayers
        .filter((player) => passesHardRules(player, unavailableSlugs, new Set([...existingBenchSlugs, ...suggestedBenchSlugs])))
        .map((player) => scoreCandidate(player, weekKey))
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.player.name.localeCompare(b.player.name, undefined, { sensitivity: "base" }),
        );

      for (const candidate of candidates) {
        if (suggestedBenchPlayers.length >= additionalBenchNeeded) {
          break;
        }

        const currentBenchSlugs = new Set([...existingBenchSlugs, ...suggestedBenchSlugs]);

        if (!passesHardRules(candidate.player, unavailableSlugs, currentBenchSlugs)) {
          continue;
        }

        suggestedBenchPlayers.push(getStatusPlayer(candidate.player));
        suggestedBenchSlugs.add(candidate.player.slug);
        notes.push(
          `${candidate.player.name} selected${candidate.reasons.length > 0 ? ` for ${formatRuleList(candidate.reasons.slice(0, 2))}` : ""}.`,
        );
      }

      if (suggestedBenchPlayers.length < additionalBenchNeeded) {
        warnings.push(
          "Could not suggest a full bench list for this week because too many players are unavailable or constraints would be violated.",
        );
        warnings.push("No valid bench suggestion found without violating constraints.");
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

    return {
      label: formatWeekDateRange(nights),
      rosterSize: activeRosterSize,
      unavailablePlayers,
      requiredBenchCount,
      existingBenchPlayers,
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
  return lines.join("\n").trim();
};
