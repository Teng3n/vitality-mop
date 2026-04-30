export interface RaidBuffPlayer {
  name: string;
  className?: string;
  spec?: string;
}

export interface RaidBuffCoverage {
  missing: string[];
  detail: string;
}

interface RaidBuffRule {
  name: string;
  isProvidedBy: (player: RaidBuffPlayer) => boolean;
}

const normalizeKey = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");

const hasClass = (player: RaidBuffPlayer, ...classNames: string[]) =>
  classNames.some((className) => normalizeKey(player.className ?? "") === normalizeKey(className));

const hasSpec = (player: RaidBuffPlayer, ...specs: string[]) =>
  Boolean(player.spec) && specs.some((spec) => normalizeKey(player.spec ?? "") === normalizeKey(spec));

export const trackedRaidBuffs: RaidBuffRule[] = [
  {
    name: "5% Stats",
    isProvidedBy: (player) => hasClass(player, "Druid", "Monk", "Paladin"),
  },
  {
    name: "10% Stamina",
    isProvidedBy: (player) => hasClass(player, "Priest", "Warlock", "Warrior"),
  },
  {
    name: "10% Attack Power",
    isProvidedBy: (player) => hasClass(player, "Death Knight", "Hunter", "Warrior"),
  },
  {
    name: "10% Spell Power",
    isProvidedBy: (player) => hasClass(player, "Mage", "Shaman", "Warlock"),
  },
  {
    name: "10% Attack Speed",
    isProvidedBy: (player) =>
      hasClass(player, "Rogue") ||
      (hasClass(player, "Death Knight") && hasSpec(player, "Frost", "Unholy")) ||
      (hasClass(player, "Shaman") && hasSpec(player, "Enhancement")),
  },
  {
    name: "5% Spell Haste",
    isProvidedBy: (player) =>
      hasClass(player, "Shaman") ||
      (hasClass(player, "Druid") && hasSpec(player, "Balance")) ||
      (hasClass(player, "Priest") && hasSpec(player, "Shadow")),
  },
  {
    name: "5% Crit",
    isProvidedBy: (player) =>
      hasClass(player, "Mage") ||
      (hasClass(player, "Druid") && hasSpec(player, "Feral", "Guardian")) ||
      (hasClass(player, "Monk") && hasSpec(player, "Windwalker")),
  },
  {
    name: "Mastery",
    isProvidedBy: (player) => hasClass(player, "Paladin", "Shaman"),
  },
];

export const getRaidBuffCoverage = (raidReadyPlayers: RaidBuffPlayer[]): RaidBuffCoverage => {
  const missing: string[] = [];
  const detail: string[] = [];

  for (const buff of trackedRaidBuffs) {
    const providers = raidReadyPlayers.filter((player) => buff.isProvidedBy(player)).map((player) => player.name);

    if (providers.length > 0) {
      detail.push(`${buff.name}: covered by ${providers.join(", ")}`);
    } else {
      missing.push(buff.name);
      detail.push(`${buff.name}: missing`);
    }
  }

  return {
    missing,
    detail: detail.join("\n"),
  };
};
