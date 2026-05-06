export type DifficultyStatus = "Killed" | "Best Pull" | "No Data";

export type ProgressionDifficulty = {
  status?: string | null;
  firstKillDate?: string | null;
  latestKillDate?: string | null;
  bestPercent?: number | null;
  reportCode?: string | null;
  reportUrl?: string | null;
  pulls?: number | null;
  kills?: number | null;
};

export type ProgressionBoss = {
  name?: string | null;
  encounterId?: number | null;
  difficulties?: Record<string, ProgressionDifficulty | undefined> | null;
};

export type ProgressionRaid = {
  name?: string | null;
  zoneId?: number | null;
  sourceGuildId?: number | null;
  sourceGuildName?: string | null;
  sourceServerSlug?: string | null;
  sourceRegion?: string | null;
  sourceLabel?: string | null;
  sourceLabels?: string[] | null;
  bosses?: ProgressionBoss[] | null;
};

export type ProgressionSource = {
  guildId?: number | null;
  guildName?: string | null;
  serverSlug?: string | null;
  region?: string | null;
  label?: string | null;
  tiers?: string[] | null;
};

export type ProgressionSeed = {
  guild?: {
    name?: string | null;
    server?: string | null;
    serverSlug?: string | null;
    region?: string | null;
  } | null;
  sources?: ProgressionSource[] | null;
  raids?: ProgressionRaid[] | null;
};

export type KillRecord = {
  raidName: string;
  bossName: string;
  difficultyName: string;
  date: string;
};

export type CompletedDifficulty = "Heroic" | "Normal" | null;

export type RaidProgress = {
  heroicBosses: number;
  normalBosses: number;
  killedBosses: number;
  totalBosses: number;
  unkilledBosses: number;
};

export type ProgressionTier = {
  slug: string;
  name: string;
  raidNames: string[];
};

export const progressionTiers: ProgressionTier[] = [
  {
    slug: "tier-14",
    name: "Tier 14",
    raidNames: ["Mogu'shan Vaults", "Heart of Fear", "Terrace of Endless Spring"],
  },
  {
    slug: "tier-15",
    name: "Tier 15",
    raidNames: ["Throne of Thunder"],
  },
  {
    slug: "tier-16",
    name: "Tier 16",
    raidNames: ["Siege of Orgrimmar"],
  },
];

const emptyProgress: RaidProgress = {
  heroicBosses: 0,
  normalBosses: 0,
  killedBosses: 0,
  totalBosses: 0,
  unkilledBosses: 0,
};

export const normalizeProgressionName = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const throneOfThunderEncounterOrder = new Map<number, number>([
  [51577, 1],
  [51575, 2],
  [51570, 3],
  [51565, 4],
  [51578, 5],
  [51573, 6],
  [51572, 7],
  [51574, 8],
  [51576, 9],
  [51559, 10],
  [51560, 11],
  [51579, 12],
  [51580, 13],
]);

const throneOfThunderNameOrder = new Map<string, number>([
  ["jinrokhthebreaker", 1],
  ["horridon", 2],
  ["councilofelders", 3],
  ["tortos", 4],
  ["megaera", 5],
  ["jikun", 6],
  ["durumutheforgotten", 7],
  ["primordius", 8],
  ["darkanimus", 9],
  ["ironqon", 10],
  ["twinconsorts", 11],
  ["twinempyreans", 11],
  ["leishen", 12],
  ["raden", 13],
]);

export const getDifficulty = (boss: ProgressionBoss, difficultyName: string): ProgressionDifficulty | undefined =>
  boss.difficulties?.[difficultyName];

export const getDifficultyStatus = (difficulty?: ProgressionDifficulty): DifficultyStatus => {
  if (!difficulty) {
    return "No Data";
  }

  const status = String(difficulty.status ?? "").trim().toLowerCase();

  if (status === "killed") {
    return "Killed";
  }

  if (status === "best pull") {
    return "Best Pull";
  }

  return "No Data";
};

export const isDifficultyKilled = (difficulty?: ProgressionDifficulty) => getDifficultyStatus(difficulty) === "Killed";

export const getBestCompletedDifficulty = (boss: ProgressionBoss): CompletedDifficulty => {
  const heroicKilled = isDifficultyKilled(getDifficulty(boss, "Heroic"));
  const normalKilled = isDifficultyKilled(getDifficulty(boss, "Normal"));

  if (heroicKilled) {
    return "Heroic";
  }

  if (normalKilled) {
    return "Normal";
  }

  return null;
};

export const getRaidProgress = (raid: ProgressionRaid): RaidProgress => {
  const bosses = Array.isArray(raid.bosses) ? raid.bosses : [];
  const totalBosses = bosses.length;
  const heroicBosses = bosses.filter((boss) => getBestCompletedDifficulty(boss) === "Heroic").length;
  const normalBosses = bosses.filter((boss) => getBestCompletedDifficulty(boss) === "Normal").length;
  const killedBosses = heroicBosses + normalBosses;

  return {
    heroicBosses,
    normalBosses,
    killedBosses,
    totalBosses,
    unkilledBosses: totalBosses - killedBosses,
  };
};

export const combineProgress = (progressList: RaidProgress[]): RaidProgress => {
  const total = progressList.reduce(
    (sum, progress) => ({
      heroicBosses: sum.heroicBosses + progress.heroicBosses,
      normalBosses: sum.normalBosses + progress.normalBosses,
      killedBosses: sum.killedBosses + progress.killedBosses,
      totalBosses: sum.totalBosses + progress.totalBosses,
    }),
    { heroicBosses: 0, normalBosses: 0, killedBosses: 0, totalBosses: 0 },
  );

  return {
    ...total,
    unkilledBosses: total.totalBosses - total.killedBosses,
  };
};

export const getProgressBreakdown = (progress: RaidProgress) => {
  if (progress.heroicBosses > 0 && progress.normalBosses > 0) {
    return `${progress.heroicBosses}H / ${progress.normalBosses}N`;
  }

  if (progress.heroicBosses > 0) {
    return `${progress.heroicBosses}H`;
  }

  if (progress.normalBosses > 0) {
    return `${progress.normalBosses}N`;
  }

  return "No kills";
};

export const getBestDifficultyLabel = (progress: RaidProgress) => {
  if (progress.heroicBosses > 0) {
    return "Heroic";
  }

  if (progress.normalBosses > 0) {
    return "Normal";
  }

  return "No kills";
};

export const getDifficultyKillDate = (difficulty?: ProgressionDifficulty) =>
  difficulty?.latestKillDate || difficulty?.firstKillDate || "";

export const getLatestKills = (sourceRaids: ProgressionRaid[]) => {
  const kills: KillRecord[] = [];

  for (const raid of sourceRaids) {
    const raidName = raid.name || "Unknown Raid";

    for (const boss of raid.bosses ?? []) {
      const bossName = boss.name || "Unknown Boss";

      for (const [difficultyName, difficulty] of Object.entries(boss.difficulties ?? {})) {
        if (getDifficultyStatus(difficulty) !== "Killed") {
          continue;
        }

        const date = getDifficultyKillDate(difficulty);

        if (date) {
          kills.push({ raidName, bossName, difficultyName, date });
        }
      }
    }
  }

  return kills.sort((a, b) => b.date.localeCompare(a.date));
};

export const getRaidLatestKill = (raid: ProgressionRaid) => getLatestKills([raid])[0];

export const getTierBySlug = (slug?: string) => progressionTiers.find((tier) => tier.slug === slug);

export const getTierForRaidName = (raidName?: string | null) => {
  const normalizedRaidName = normalizeProgressionName(raidName);

  return progressionTiers.find((tier) =>
    tier.raidNames.some((tierRaidName) => normalizeProgressionName(tierRaidName) === normalizedRaidName),
  );
};

export const getTierRaids = (tier: ProgressionTier, raids: ProgressionRaid[]) => {
  const raidByName = new Map(raids.map((raid) => [normalizeProgressionName(raid.name), raid]));

  return tier.raidNames
    .map((raidName) => raidByName.get(normalizeProgressionName(raidName)))
    .filter((raid): raid is ProgressionRaid => Boolean(raid));
};

export const getRaidSourceLabels = (raid?: ProgressionRaid | null) => {
  const labels = [
    ...(Array.isArray(raid?.sourceLabels) ? raid.sourceLabels : []),
    raid?.sourceLabel,
  ]
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);

  return [...new Set(labels)];
};

export const getTierSourceLabels = (tier: ProgressionTier, raids: ProgressionRaid[]) => [
  ...new Set(getTierRaids(tier, raids).flatMap(getRaidSourceLabels)),
];

export const getProgressionSourceLabels = (seed: ProgressionSeed) => {
  const sourceLabels = (seed.sources ?? [])
    .map((source) => String(source?.label ?? "").trim())
    .filter(Boolean);

  if (sourceLabels.length > 0) {
    return [...new Set(sourceLabels)];
  }

  const guild = String(seed.guild?.name ?? "").trim();
  const server = String(seed.guild?.server ?? "").trim();

  return guild && server ? [`${guild} - ${server}`] : [];
};

export const getTierProgress = (tier: ProgressionTier, raids: ProgressionRaid[]) =>
  combineProgress(getTierRaids(tier, raids).map(getRaidProgress));

export const getTierLatestKill = (tier: ProgressionTier, raids: ProgressionRaid[]) => getLatestKills(getTierRaids(tier, raids))[0];

export const getCurrentRaid = (raids: ProgressionRaid[]) => {
  const latestKill = getLatestKills(raids)[0];

  return (latestKill ? raids.find((raid) => (raid.name || "Unknown Raid") === latestKill.raidName) : undefined) ?? raids[0];
};

export const getCurrentTier = (raids: ProgressionRaid[]) => {
  const currentRaid = getCurrentRaid(raids);

  return getTierForRaidName(currentRaid?.name) ?? progressionTiers[0];
};

export const getCurrentTierProgress = (raids: ProgressionRaid[]) => {
  const tier = getCurrentTier(raids);

  return tier ? getTierProgress(tier, raids) : emptyProgress;
};

const getBossSortOrder = (raid: ProgressionRaid, boss: ProgressionBoss) => {
  if (normalizeProgressionName(raid.name) !== "throneofthunder") {
    return Number.POSITIVE_INFINITY;
  }

  if (typeof boss.encounterId === "number" && throneOfThunderEncounterOrder.has(boss.encounterId)) {
    return throneOfThunderEncounterOrder.get(boss.encounterId) ?? Number.POSITIVE_INFINITY;
  }

  return throneOfThunderNameOrder.get(normalizeProgressionName(boss.name)) ?? Number.POSITIVE_INFINITY;
};

export const getSortedBosses = (raid: ProgressionRaid) =>
  [...(raid.bosses ?? [])].sort(
    (a, b) =>
      getBossSortOrder(raid, a) - getBossSortOrder(raid, b) ||
      (a.encounterId ?? Number.POSITIVE_INFINITY) - (b.encounterId ?? Number.POSITIVE_INFINITY) ||
      (a.name || "").localeCompare(b.name || ""),
  );
