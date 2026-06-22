import {
  SIEGE_OF_ORGRIMMAR_BIS_LISTS,
  SIEGE_OF_ORGRIMMAR_BOSSES,
} from "../data/siegeOfOrgrimmarBis";
import {
  activeRosterPlayers,
  countsTowardMainSpecTotal,
  lootAwards,
  type LootAward,
  type Player,
} from "./guildData";
import { normalizePlayerName } from "./playerNames";

type GearNeedImportance = "BiS / huge" | "Major" | "Minor / slot" | "Tier";

export interface GearNeedTarget {
  item: string;
  bossName: string;
  slot: string;
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
  href: string;
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
const getSpecKey = (spec: string, className: string) => normalizeKey(`${spec} ${className}`);
const getItemKey = (item: string) => normalizeKey(item);
const getTargetKey = (target: GearNeedTarget) => `${getItemKey(target.item)}:${normalizeKey(target.slot)}`;
const allBisItems = SIEGE_OF_ORGRIMMAR_BIS_LISTS.flatMap((spec) => spec.items);
const trackedItemKeys = new Set(allBisItems.map((item) => getItemKey(item.item)));
const bisListBySpecKey = new Map(
  SIEGE_OF_ORGRIMMAR_BIS_LISTS.map((spec) => [getSpecKey(spec.spec, spec.className), spec]),
);
const tierTokenGroups = {
  protector: ["Hunter", "Monk", "Shaman", "Warrior"],
  vanquisher: ["Death Knight", "Druid", "Mage", "Rogue"],
  conqueror: ["Paladin", "Priest", "Warlock"],
} as const;
const tierTokenSlotNames = {
  Head: "Helm",
  Shoulder: "Shoulders",
  Chest: "Chest",
  Gloves: "Gauntlets",
  Legs: "Leggings",
} as const;
const tierSetNamesByClass: Record<string, string[]> = {
  "Death Knight": ["Cyclopean Dread"],
  Druid: ["Shattered Vale"],
  Hunter: ["Unblinking Vigil"],
  Mage: ["Chronomancer"],
  Monk: ["Seven Sacred Seals"],
  Paladin: ["Winged Triumph"],
  Priest: ["Ternion Glory"],
  Rogue: ["Barbed Assassin"],
  Shaman: ["Celestial Harmony"],
  Warlock: ["Horned Nightmare"],
  Warrior: ["Prehistoric Marauder"],
};
const tierTokenByItemKey = new Map(
  Object.entries(tierTokenGroups).flatMap(([group, classes]) =>
    Object.entries(tierTokenSlotNames).map(([slot, tokenSlotName]) => [
      getItemKey(`${tokenSlotName} of the Cursed ${group}`),
      {
        slot,
        classes: new Set(classes.map((className) => normalizeKey(className))),
      },
    ] as const),
  ),
);
const tierTokenItemKeys = new Set(tierTokenByItemKey.keys());

const awardCountsTowardGear = (award: LootAward) =>
  countsTowardMainSpecTotal(award.responseType) || normalizeKey(award.responseType) === "bonus loot";

const matchingTrackedLootAwards = lootAwards.filter(
  (award) => (trackedItemKeys.has(getItemKey(award.item)) || tierTokenItemKeys.has(getItemKey(award.item))) && awardCountsTowardGear(award),
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

const getBossTargetsForPlayer = (bossName: string, player: Player): GearNeedTarget[] => {
  const playerSpecKey = getSpecKey(player.spec, player.className);
  const playerBisList = bisListBySpecKey.get(playerSpecKey);

  return (playerBisList?.items ?? [])
    .filter((item) => item.boss === bossName)
    .map((item) => ({
      item: item.item,
      bossName,
      slot: item.slot,
      category: item.slot,
      importance: "BiS / huge",
      reason: "BiS",
    }));
};

const isTierTargetForPlayer = (player: Player, target: GearNeedTarget) => {
  if (!Object.prototype.hasOwnProperty.call(tierTokenSlotNames, target.slot)) {
    return false;
  }

  const tierSetNames = tierSetNamesByClass[player.className] ?? [];
  const targetItemKey = getItemKey(target.item);
  return tierSetNames.some((tierSetName) => targetItemKey.includes(getItemKey(tierSetName)));
};

const getEquivalentTierTokenKeys = (player: Player, target: GearNeedTarget) => {
  if (!isTierTargetForPlayer(player, target)) {
    return [];
  }

  const playerClassKey = normalizeKey(player.className);

  return [...tierTokenByItemKey.entries()]
    .filter(([, token]) => token.slot === target.slot && token.classes.has(playerClassKey))
    .map(([itemKey]) => itemKey);
};

const getAwardsForTarget = (
  player: Player,
  target: GearNeedTarget,
  awardsByItem: Map<string, LootAward[]> | undefined,
) => {
  const awardKeys = [getItemKey(target.item), ...getEquivalentTierTokenKeys(player, target)];
  const awardsByUniqueKey = new Map<string, LootAward>();

  for (const awardKey of awardKeys) {
    for (const award of awardsByItem?.get(awardKey) ?? []) {
      awardsByUniqueKey.set(`${award.date}:${award.item}:${award.boss}:${award.responseType}`, award);
    }
  }

  return [...awardsByUniqueKey.values()];
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
  acquiredAwardsByTargetKey: Map<string, LootAward[]>,
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
    href: player.href,
    warcraftLogsUrl: player.warcraftLogsDirectUrl ?? player.warcraftLogsUrl,
    needs,
    acquired: acquiredTargets.flatMap((target) => getAwardSummaries(acquiredAwardsByTargetKey.get(getTargetKey(target)))),
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
  const bosses = SIEGE_OF_ORGRIMMAR_BOSSES
    .map((bossName, index): BossGearNeed => {
      const players: PlayerBossGearStatus[] = [];

      for (const player of activeRosterPlayers) {
        const targets = getBossTargetsForPlayer(bossName, player);
        const awardsByItem = awardsByPlayerAndItem.get(normalizePlayerName(player.name));
        const acquiredAwardsByTargetKey = new Map<string, LootAward[]>();
        const openTargets: GearNeedTarget[] = [];
        const acquiredTargets: GearNeedTarget[] = [];

        for (const target of targets) {
          const targetAwards = getAwardsForTarget(player, target, awardsByItem);

          if (targetAwards.length > 0) {
            acquiredTargets.push(target);
            acquiredAwardsByTargetKey.set(getTargetKey(target), targetAwards);
          } else {
            openTargets.push(target);
          }
        }

        players.push(getPlayerBossGearStatus(player, openTargets, acquiredTargets, acquiredAwardsByTargetKey, targets.length));
      }

      const sortedPlayers = sortBossPlayers(players);
      const stillNeeds = sortedPlayers.filter((player) => player.status === "needs");
      const acquired = sortedPlayers.filter((player) => player.status === "complete");

      return {
        bossName,
        order: index + 1,
        players: sortedPlayers,
        stillNeeds,
        acquired,
        targetCount: allBisItems.filter((item) => item.boss === bossName).length,
        stillNeedsCount: stillNeeds.reduce((sum, player) => sum + player.needs.length, 0),
        safeCount: sortedPlayers.filter((player) => player.status !== "needs").length,
      };
    })
    .sort((a, b) => a.order - b.order);

  const playersWithOpenNeeds = new Set(bosses.flatMap((boss) => boss.stillNeeds.map((player) => player.slug)));

  return {
    generatedAt: new Date().toISOString(),
    scope: "Siege of Orgrimmar boss BiS targets across all bosses.",
    notes: [
      "Loot history is treated as authoritative for known awards, including bonus loot and class tier tokens.",
      "Warcraft Logs current gear is not imported yet; player profile links are included as the baseline check until a reliable equipped-gear feed is wired in.",
      "This report is driven by the officer BiS list data. Non-BiS sidegrades are intentionally excluded.",
    ],
    summary: {
      activeRosterCount: activeRosterPlayers.length,
      bossCount: bosses.length,
      targetCount: allBisItems.length,
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
          .map((need) => `${need.item} (${need.slot})`)
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
