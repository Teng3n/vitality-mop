import gearNeedsData from "../data/siegeOfOrgrimmarGearNeeds.json";
import {
  activeRosterPlayers,
  countsTowardMainSpecTotal,
  lootAwards,
  type LootAward,
  type Player,
} from "./guildData";
import { normalizePlayerName } from "./playerNames";

type GearNeedImportance = "BiS / huge" | "Major" | "Minor / slot" | "Tier";

interface GearNeedItemData {
  item: string;
  category: string;
  importance: GearNeedImportance;
  reason: string;
  specs: string[];
}

interface GearNeedBossData {
  boss: string;
  order: number;
  aliases?: string[];
  items: GearNeedItemData[];
}

export interface GearNeedTarget {
  item: string;
  bossName: string;
  category: string;
  importance: GearNeedImportance;
  reason: string;
}

export interface PlayerGearNeed {
  slug: string;
  name: string;
  className: string;
  spec: string;
  role: string;
  warcraftLogsUrl: string;
  needs: GearNeedTarget[];
  acquired: PlayerGearAward[];
}

export type PlayerGearNeedStatus = "needs" | "complete" | "no-tracked-need";

export interface PlayerBossGearStatus extends PlayerGearNeed {
  status: PlayerGearNeedStatus;
  statusLabel: string;
  targetCount: number;
}

export interface PlayerGearAward {
  item: string;
  date: string;
  boss: string;
  responseType: string;
}

export interface BossGearNeed {
  bossName: string;
  order: number;
  players: PlayerBossGearStatus[];
  stillNeeds: PlayerGearNeed[];
  acquired: PlayerGearNeed[];
  targetCount: number;
  stillNeedsCount: number;
  safeCount: number;
}

export interface GearNeedsReport {
  generatedAt: string;
  scope: string;
  notes: string[];
  summary: {
    activeRosterCount: number;
    bossCount: number;
    targetCount: number;
    lootAwardsConsidered: number;
    playersWithOpenNeeds: number;
    warcraftLogsBaseline: string;
  };
  bosses: BossGearNeed[];
}

const normalizeKey = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const gearNeedBosses = gearNeedsData as GearNeedBossData[];
const getSpecKey = (spec: string, className: string) => normalizeKey(`${spec} ${className}`);
const getItemKey = (item: string) => normalizeKey(item);
const trackedItemKeys = new Set(gearNeedBosses.flatMap((boss) => boss.items.map((item) => getItemKey(item.item))));

const awardCountsTowardGear = (award: LootAward) =>
  countsTowardMainSpecTotal(award.responseType) || normalizeKey(award.responseType) === "bonus loot";

const matchingTrackedLootAwards = lootAwards.filter(
  (award) => trackedItemKeys.has(getItemKey(award.item)) && awardCountsTowardGear(award),
);

const getAwardsByPlayerAndItem = () => {
  const awardsByPlayerAndItem = new Map<string, Map<string, LootAward[]>>();

  for (const award of matchingTrackedLootAwards) {
    const playerKey = normalizePlayerName(award.player);
    const itemKey = getItemKey(award.item);
    const awardsByItem = awardsByPlayerAndItem.get(playerKey) ?? new Map<string, LootAward[]>();
    const itemAwards = awardsByItem.get(itemKey) ?? [];
    itemAwards.push(award);
    awardsByItem.set(itemKey, itemAwards);
    awardsByPlayerAndItem.set(playerKey, awardsByItem);
  }

  return awardsByPlayerAndItem;
};

const getBossTargetsForPlayer = (boss: GearNeedBossData, player: Player): GearNeedTarget[] => {
  const playerSpecKey = getSpecKey(player.spec, player.className);

  return boss.items
    .filter((item) => item.specs.some((spec) => normalizeKey(spec) === playerSpecKey))
    .map((item) => ({
      item: item.item,
      bossName: boss.boss,
      category: item.category,
      importance: item.importance,
      reason: item.reason,
    }));
};

const getAwardSummaries = (awards: LootAward[] = []): PlayerGearAward[] =>
  awards
    .map((award) => ({
      item: award.item,
      date: award.date,
      boss: award.boss,
      responseType: award.responseType,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

const getPlayerBossGearStatus = (
  player: Player,
  needs: GearNeedTarget[],
  acquiredTargets: GearNeedTarget[],
  awardsByItem: Map<string, LootAward[]> | undefined,
  targetCount: number,
): PlayerBossGearStatus => {
  const status: PlayerGearNeedStatus =
    needs.length > 0 ? "needs" : targetCount > 0 ? "complete" : "no-tracked-need";

  return {
    slug: player.slug,
    name: player.name,
    className: player.className,
    spec: player.spec,
    role: player.role,
    warcraftLogsUrl: player.warcraftLogsDirectUrl ?? player.warcraftLogsUrl,
    needs,
    acquired: acquiredTargets.flatMap((target) => getAwardSummaries(awardsByItem?.get(getItemKey(target.item)))),
    status,
    statusLabel:
      status === "needs"
        ? "Needs loot"
        : status === "complete"
          ? "Tracked loot done"
          : "No tracked loot",
    targetCount,
  };
};

const sortBossPlayers = (players: PlayerBossGearStatus[]) => {
  const statusRank: Record<PlayerGearNeedStatus, number> = {
    needs: 0,
    complete: 1,
    "no-tracked-need": 2,
  };

  return players.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      b.needs.length - a.needs.length ||
      a.className.localeCompare(b.className, undefined, { sensitivity: "base" }) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
};

export const getGearNeedsReport = (): GearNeedsReport => {
  const awardsByPlayerAndItem = getAwardsByPlayerAndItem();
  const bosses = gearNeedBosses
    .map((boss): BossGearNeed => {
      const players: PlayerBossGearStatus[] = [];

      for (const player of activeRosterPlayers) {
        const targets = getBossTargetsForPlayer(boss, player);
        const awardsByItem = awardsByPlayerAndItem.get(normalizePlayerName(player.name));
        const openTargets = targets.filter((target) => !awardsByItem?.has(getItemKey(target.item)));
        const acquiredTargets = targets.filter((target) => awardsByItem?.has(getItemKey(target.item)));

        players.push(getPlayerBossGearStatus(player, openTargets, acquiredTargets, awardsByItem, targets.length));
      }

      const sortedPlayers = sortBossPlayers(players);
      const stillNeeds = sortedPlayers.filter((player) => player.status === "needs");
      const acquired = sortedPlayers.filter((player) => player.status === "complete");

      return {
        bossName: boss.boss,
        order: boss.order,
        players: sortedPlayers,
        stillNeeds,
        acquired,
        targetCount: boss.items.length,
        stillNeedsCount: stillNeeds.reduce((sum, player) => sum + player.needs.length, 0),
        safeCount: sortedPlayers.filter((player) => player.status !== "needs").length,
      };
    })
    .sort((a, b) => a.order - b.order);

  const playersWithOpenNeeds = new Set(bosses.flatMap((boss) => boss.stillNeeds.map((player) => player.slug)));

  return {
    generatedAt: new Date().toISOString(),
    scope: "Siege of Orgrimmar curated early heroic bosses through Kor'kron Dark Shaman.",
    notes: [
      "Loot history is treated as authoritative for known awards, including bonus loot.",
      "Warcraft Logs current gear is not imported yet; player profile links are included as the baseline check until a reliable equipped-gear feed is wired in.",
      "This report tracks curated BiS and major upgrade targets, not every possible sidegrade.",
    ],
    summary: {
      activeRosterCount: activeRosterPlayers.length,
      bossCount: bosses.length,
      targetCount: gearNeedBosses.reduce((sum, boss) => sum + boss.items.length, 0),
      lootAwardsConsidered: matchingTrackedLootAwards.length,
      playersWithOpenNeeds: playersWithOpenNeeds.size,
      warcraftLogsBaseline: "profile links only",
    },
    bosses,
  };
};

export const getGearNeedsText = (report = getGearNeedsReport()) => {
  const lines = [
    "Gear Needs by Boss",
    report.scope,
    "",
    `Roster: ${report.summary.activeRosterCount}`,
    `Loot awards considered: ${report.summary.lootAwardsConsidered}`,
    `Warcraft Logs baseline: ${report.summary.warcraftLogsBaseline}`,
    "",
  ];

  for (const boss of report.bosses) {
    lines.push(`${boss.order}. ${boss.bossName}`);

    if (boss.stillNeeds.length === 0) {
      lines.push("Still needs: None tracked");
    } else {
      for (const player of boss.stillNeeds) {
        const items = player.needs
          .map((need) => `${need.item} (${need.category}, ${need.importance}: ${need.reason})`)
          .join("; ");
        lines.push(`- ${player.name} (${player.spec} ${player.className}): ${items}`);
      }
    }

    lines.push("");
  }

  lines.push("Notes:");
  lines.push(...report.notes.map((note) => `- ${note}`));

  return lines.join("\n").trim();
};
