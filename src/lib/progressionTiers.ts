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
  expansionSlug?: string | null;
  tierSlug?: string | null;
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
  expansions?: string[] | null;
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
  raidAliases?: string[];
  isPlaceholder?: boolean;
  displayDifficulties: Array<"Normal" | "Heroic">;
  releaseStatus?: "released" | "unreleased";
};

export type ProgressionExpansion = {
  slug: string;
  name: string;
  shortName: string;
  isPlaceholder?: boolean;
  tiers: ProgressionTier[];
};

const classicProgressionTiers: ProgressionTier[] = [
  {
    slug: "classic-mc-ony",
    name: "Molten Core / Onyxia",
    raidNames: ["Molten Core", "Onyxia's Lair"],
    raidAliases: ["Onyxia"],
    displayDifficulties: [],
  },
  {
    slug: "classic-bwl",
    name: "Blackwing Lair",
    raidNames: ["Blackwing Lair"],
    displayDifficulties: [],
  },
  {
    slug: "classic-aq",
    name: "Ahn'Qiraj",
    raidNames: ["Temple of Ahn'Qiraj", "Ruins of Ahn'Qiraj", "Ahn'Qiraj"],
    displayDifficulties: [],
  },
  {
    slug: "classic-naxx",
    name: "Naxxramas",
    raidNames: ["Naxxramas"],
    displayDifficulties: [],
  },
];

const tbcProgressionTiers: ProgressionTier[] = [
  {
    slug: "tbc-tier-4",
    name: "Tier 4",
    raidNames: ["Karazhan", "Gruul's Lair", "Magtheridon's Lair"],
    raidAliases: ["Gruul / Magtheridon", "Gruul", "Magtheridon"],
    displayDifficulties: [],
  },
  {
    slug: "tbc-tier-5",
    name: "Tier 5",
    raidNames: ["Serpentshrine Cavern", "Tempest Keep", "The Eye"],
    raidAliases: ["SSC / TK", "Serpentshrine Cavern / Tempest Keep", "Serpentshrine Cavern / The Eye"],
    displayDifficulties: [],
  },
  {
    slug: "tbc-tier-6",
    name: "Tier 6",
    raidNames: ["Mount Hyjal", "Black Temple", "Battle for Mount Hyjal"],
    raidAliases: ["BT / Hyjal", "Black Temple / Hyjal", "Hyjal Summit"],
    displayDifficulties: [],
  },
  {
    slug: "tbc-sunwell",
    name: "Sunwell Plateau",
    raidNames: ["Sunwell Plateau"],
    displayDifficulties: [],
  },
];

const wrathProgressionTiers: ProgressionTier[] = [
  {
    slug: "wrath-tier-7",
    name: "Tier 7",
    raidNames: ["Naxxramas", "The Obsidian Sanctum", "The Eye of Eternity"],
    raidAliases: ["Naxx / Sarth / Maly", "Naxxramas / Obsidian Sanctum / Eye of Eternity", "Obsidian Sanctum", "Eye of Eternity"],
    displayDifficulties: [],
  },
  {
    slug: "wrath-tier-8",
    name: "Tier 8",
    raidNames: ["Ulduar"],
    displayDifficulties: [],
  },
  {
    slug: "wrath-tier-9",
    name: "Tier 9",
    raidNames: ["Trial of the Crusader", "Onyxia's Lair"],
    raidAliases: ["Onyxia"],
    displayDifficulties: ["Normal", "Heroic"],
  },
  {
    slug: "wrath-tier-10",
    name: "Tier 10",
    raidNames: ["Icecrown Citadel", "The Ruby Sanctum"],
    raidAliases: ["Ruby Sanctum"],
    displayDifficulties: ["Normal", "Heroic"],
  },
];

const cataProgressionTiers: ProgressionTier[] = [
  {
    slug: "cata-tier-11",
    name: "Tier 11",
    raidNames: ["Blackwing Descent", "The Bastion of Twilight", "Throne of the Four Winds"],
    raidAliases: ["TotFW / BWD / BoT", "Throne of the Four Winds / Blackwing Descent / Bastion of Twilight", "Bastion of Twilight"],
    displayDifficulties: ["Normal", "Heroic"],
  },
  {
    slug: "cata-tier-12",
    name: "Tier 12",
    raidNames: ["Firelands"],
    displayDifficulties: ["Normal", "Heroic"],
  },
  {
    slug: "cata-tier-13",
    name: "Tier 13",
    raidNames: ["Dragon Soul"],
    displayDifficulties: ["Normal", "Heroic"],
  },
];

export const progressionTiers: ProgressionTier[] = [
  {
    slug: "tier-14",
    name: "Tier 14",
    raidNames: ["Mogu'shan Vaults", "Heart of Fear", "Terrace of Endless Spring"],
    displayDifficulties: ["Normal", "Heroic"],
  },
  {
    slug: "tier-15",
    name: "Tier 15",
    raidNames: ["Throne of Thunder"],
    displayDifficulties: ["Normal", "Heroic"],
  },
  {
    slug: "tier-16",
    name: "Tier 16",
    raidNames: ["Siege of Orgrimmar"],
    displayDifficulties: ["Normal", "Heroic"],
    releaseStatus: "unreleased",
  },
];

export const progressionExpansions: ProgressionExpansion[] = [
  {
    slug: "mop",
    name: "Mists of Pandaria Classic",
    shortName: "Mists of Pandaria Classic",
    tiers: [progressionTiers[2], progressionTiers[1], progressionTiers[0]],
  },
  {
    slug: "cata",
    name: "Cataclysm Classic",
    shortName: "Cataclysm Classic",
    tiers: [cataProgressionTiers[2], cataProgressionTiers[1], cataProgressionTiers[0]],
  },
  {
    slug: "wrath",
    name: "Wrath of the Lich King Classic",
    shortName: "Wrath of the Lich King Classic",
    tiers: [wrathProgressionTiers[3], wrathProgressionTiers[2], wrathProgressionTiers[1], wrathProgressionTiers[0]],
  },
  {
    slug: "tbc",
    name: "The Burning Crusade Classic",
    shortName: "The Burning Crusade Classic",
    tiers: [tbcProgressionTiers[3], tbcProgressionTiers[2], tbcProgressionTiers[1], tbcProgressionTiers[0]],
  },
  {
    slug: "classic",
    name: "Vanilla Classic",
    shortName: "Vanilla Classic",
    tiers: [classicProgressionTiers[3], classicProgressionTiers[2], classicProgressionTiers[1], classicProgressionTiers[0]],
  },
];

export const allProgressionTiers: ProgressionTier[] = progressionExpansions.flatMap((expansion) => expansion.tiers);

export const normalizeProgressionName = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const bossEncounterOrders = new Map<string, Map<number, number>>([
  [
    "mogushanvaults",
    new Map([
      [1395, 1],
      [1390, 2],
      [1434, 3],
      [1436, 4],
      [1500, 5],
      [1407, 6],
    ]),
  ],
  [
    "heartoffear",
    new Map([
      [1507, 1],
      [1504, 2],
      [1463, 3],
      [1498, 4],
      [1499, 5],
      [1501, 6],
    ]),
  ],
  [
    "terraceofendlessspring",
    new Map([
      [1409, 1],
      [1505, 2],
      [1506, 3],
      [1431, 4],
    ]),
  ],
  [
    "throneofthunder",
    new Map([
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
    ]),
  ],
]);

const createBossOrder = (names: string[]) =>
  new Map(names.map((name, index) => [normalizeProgressionName(name), index + 1]));

const bossNameOrders = new Map<string, Map<string, number>>([
  ["moltencore", createBossOrder(["Lucifron", "Magmadar", "Gehennas", "Garr", "Baron Geddon", "Shazzrah", "Sulfuron Harbinger", "Golemagg the Incinerator", "Majordomo Executus", "Ragnaros"])],
  ["onyxiaslair", createBossOrder(["Onyxia"])],
  ["blackwinglair", createBossOrder(["Razorgore the Untamed", "Vaelastrasz the Corrupt", "Broodlord Lashlayer", "Firemaw", "Ebonroc", "Flamegor", "Chromaggus", "Nefarian"])],
  ["ruinsofahnqiraj", createBossOrder(["Kurinnaxx", "General Rajaxx", "Moam", "Buru the Gorger", "Ayamiss the Hunter", "Ossirian the Unscarred"])],
  ["templeofahnqiraj", createBossOrder(["The Prophet Skeram", "Silithid Royalty", "Battleguard Sartura", "Fankriss the Unyielding", "Viscidus", "Princess Huhuran", "Twin Emperors", "Ouro", "C'Thun"])],
  ["ahnqiraj", createBossOrder(["The Prophet Skeram", "Silithid Royalty", "Battleguard Sartura", "Fankriss the Unyielding", "Viscidus", "Princess Huhuran", "Twin Emperors", "Ouro", "C'Thun"])],
  ["naxxramas", createBossOrder(["Anub'Rekhan", "Grand Widow Faerlina", "Maexxna", "Noth the Plaguebringer", "Heigan the Unclean", "Loatheb", "Instructor Razuvious", "Gothik the Harvester", "The Four Horsemen", "Patchwerk", "Grobbulus", "Gluth", "Thaddius", "Sapphiron", "Kel'Thuzad"])],
  ["karazhan", createBossOrder(["Attumen the Huntsman", "Moroes", "Maiden of Virtue", "Opera Event", "The Curator", "Terestian Illhoof", "Shade of Aran", "Netherspite", "Chess Event", "Prince Malchezaar", "Nightbane"])],
  ["gruulslair", createBossOrder(["High King Maulgar", "Gruul the Dragonkiller"])],
  ["magtheridonslair", createBossOrder(["Magtheridon"])],
  ["serpentshrinecavern", createBossOrder(["Hydross the Unstable", "The Lurker Below", "Leotheras the Blind", "Fathom-Lord Karathress", "Morogrim Tidewalker", "Lady Vashj"])],
  ["tempestkeep", createBossOrder(["Al'ar", "Void Reaver", "High Astromancer Solarian", "Kael'thas Sunstrider"])],
  ["theeye", createBossOrder(["Al'ar", "Void Reaver", "High Astromancer Solarian", "Kael'thas Sunstrider"])],
  ["mounthyjal", createBossOrder(["Rage Winterchill", "Anetheron", "Kaz'rogal", "Azgalor", "Archimonde"])],
  ["battleformounthyjal", createBossOrder(["Rage Winterchill", "Anetheron", "Kaz'rogal", "Azgalor", "Archimonde"])],
  ["blacktemple", createBossOrder(["High Warlord Naj'entus", "Supremus", "Shade of Akama", "Teron Gorefiend", "Gurtogg Bloodboil", "Reliquary of Souls", "Mother Shahraz", "The Illidari Council", "Illidan Stormrage"])],
  ["sunwellplateau", createBossOrder(["Kalecgos", "Brutallus", "Felmyst", "Eredar Twins", "M'uru", "Kil'jaeden"])],
  ["theobsidiansanctum", createBossOrder(["Sartharion"])],
  ["theeyeofeternity", createBossOrder(["Malygos"])],
  ["ulduar", createBossOrder(["Flame Leviathan", "Ignis the Furnace Master", "Razorscale", "XT-002 Deconstructor", "Assembly of Iron", "The Iron Council", "Kologarn", "Auriaya", "Hodir", "Thorim", "Freya", "Mimiron", "General Vezax", "Yogg-Saron", "Algalon the Observer"])],
  ["trialofthecrusader", createBossOrder(["Northrend Beasts", "Lord Jaraxxus", "Faction Champions", "Twin Val'kyr", "Val'kyr Twins", "Anub'arak"])],
  ["icecrowncitadel", createBossOrder(["Lord Marrowgar", "Lady Deathwhisper", "Gunship Battle", "Deathbringer Saurfang", "Festergut", "Rotface", "Professor Putricide", "Blood Prince Council", "Blood-Queen Lana'thel", "Valithria Dreamwalker", "Sindragosa", "The Lich King"])],
  ["therubysanctum", createBossOrder(["Saviana Ragefire", "Baltharus the Warborn", "General Zarithrian", "Halion"])],
  ["blackwingdescent", createBossOrder(["Magmaw", "Omnotron Defense System", "Maloriak", "Atramedes", "Chimaeron", "Nefarian's End"])],
  ["thebastionoftwilight", createBossOrder(["Halfus Wyrmbreaker", "Valiona & Theralion", "Ascendant Council", "Cho'gall", "Sinestra"])],
  ["throneofthefourwinds", createBossOrder(["Conclave of Wind", "Al'Akir"])],
  ["firelands", createBossOrder(["Beth'tilac", "Lord Rhyolith", "Alysrazor", "Shannox", "Baleroc", "Majordomo Staghelm", "Ragnaros"])],
  ["dragonsoul", createBossOrder(["Morchok", "Warlord Zon'ozz", "Yor'sahj the Unsleeping", "Hagara the Stormbinder", "Ultraxion", "Warmaster Blackhorn", "Spine of Deathwing", "Madness of Deathwing"])],
  ["mogushanvaults", createBossOrder(["The Stone Guard", "Feng the Accursed", "Gara'jal the Spiritbinder", "The Spirit Kings", "Elegon", "Will of the Emperor"])],
  ["heartoffear", createBossOrder(["Imperial Vizier Zor'lok", "Blade Lord Ta'yak", "Garalon", "Wind Lord Mel'jarak", "Amber-Shaper Un'sok", "Grand Empress Shek'zeer"])],
  ["terraceofendlessspring", createBossOrder(["Protectors of the Endless", "Tsulong", "Lei Shi", "Sha of Fear"])],
  ["throneofthunder", createBossOrder(["Jin'rokh the Breaker", "Horridon", "Council of Elders", "Tortos", "Megaera", "Ji-Kun", "Durumu the Forgotten", "Primordius", "Dark Animus", "Iron Qon", "Twin Consorts", "Lei Shen", "Ra-den"])],
  ["siegeoforgrimmar", createBossOrder(["Immerseus", "The Fallen Protectors", "Norushen", "Sha of Pride", "Galakras", "Iron Juggernaut", "Kor'kron Dark Shaman", "General Nazgrim", "Malkorok", "Spoils of Pandaria", "Thok the Bloodthirsty", "Siegecrafter Blackfuse", "Paragons of the Klaxxi", "Garrosh Hellscream"])],
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

export const tierDisplaysDifficulties = (tier?: ProgressionTier | null) =>
  Array.isArray(tier?.displayDifficulties) && tier.displayDifficulties.length > 0;

export const isTierUnreleased = (tier?: ProgressionTier | null) => tier?.releaseStatus === "unreleased";

export const getProgressBreakdownForTier = (progress: RaidProgress, tier?: ProgressionTier | null) =>
  tierDisplaysDifficulties(tier) ? getProgressBreakdown(progress) : "";

export const getProgressionSummaryKillDate = (difficulty?: ProgressionDifficulty) =>
  difficulty?.firstKillDate || difficulty?.latestKillDate || "";

export const getBossBestKillRecord = (raid: ProgressionRaid, boss: ProgressionBoss): KillRecord | undefined => {
  const difficultyName = getBestCompletedDifficulty(boss);

  if (!difficultyName) {
    return undefined;
  }

  const difficulty = getDifficulty(boss, difficultyName);
  const date = getProgressionSummaryKillDate(difficulty);

  if (!date) {
    return undefined;
  }

  return {
    raidName: raid.name || "Unknown Raid",
    bossName: boss.name || "Unknown Boss",
    difficultyName,
    date,
  };
};

export const getRaidLatestKill = (raid: ProgressionRaid) => {
  const bossesByProgressionOrder = getSortedBosses(raid);

  for (let index = bossesByProgressionOrder.length - 1; index >= 0; index -= 1) {
    const killRecord = getBossBestKillRecord(raid, bossesByProgressionOrder[index]);

    if (killRecord) {
      return killRecord;
    }
  }

  return undefined;
};

const getTierMatchNames = (tier: ProgressionTier) => [...tier.raidNames, ...(tier.raidAliases ?? [])];

const getRaidConfiguredOrder = (tier: ProgressionTier, raidName?: string | null) => {
  const normalizedRaidName = normalizeProgressionName(raidName);
  const index = tier.raidNames.findIndex((tierRaidName) => normalizeProgressionName(tierRaidName) === normalizedRaidName);

  return index === -1 ? Number.POSITIVE_INFINITY : index;
};

export const getTierBySlug = (slug?: string, expansionSlug?: string) => {
  const tiers = expansionSlug
    ? progressionExpansions.find((expansion) => expansion.slug === expansionSlug)?.tiers ?? []
    : allProgressionTiers;

  return tiers.find((tier) => tier.slug === slug);
};

export const getTierForRaidName = (raidName?: string | null) => {
  const normalizedRaidName = normalizeProgressionName(raidName);

  return allProgressionTiers.find((tier) =>
    getTierMatchNames(tier).some((tierRaidName) => normalizeProgressionName(tierRaidName) === normalizedRaidName),
  );
};

export const getTierRaids = (tier: ProgressionTier, raids: ProgressionRaid[]) => {
  const taggedRaids = raids.filter((raid) => raid.tierSlug === tier.slug);

  if (taggedRaids.length > 0) {
    return taggedRaids.sort(
      (a, b) =>
        getRaidConfiguredOrder(tier, a.name) - getRaidConfiguredOrder(tier, b.name) ||
        (a.name || "").localeCompare(b.name || ""),
    );
  }

  const raidByName = new Map(raids.map((raid) => [normalizeProgressionName(raid.name), raid]));

  return tier.raidNames
    .map((raidName) => raidByName.get(normalizeProgressionName(raidName)))
    .filter((raid): raid is ProgressionRaid => Boolean(raid));
};

export const getTierProgress = (tier: ProgressionTier, raids: ProgressionRaid[]) =>
  combineProgress(getTierRaids(tier, raids).map(getRaidProgress));

export const getTierLatestKill = (tier: ProgressionTier, raids: ProgressionRaid[]) => {
  const tierRaids = getTierRaids(tier, raids);

  for (let index = tierRaids.length - 1; index >= 0; index -= 1) {
    const killRecord = getRaidLatestKill(tierRaids[index]);

    if (killRecord) {
      return killRecord;
    }
  }

  return undefined;
};

export const getRaidProgressionKill = getRaidLatestKill;

export const getTierProgressionKill = getTierLatestKill;

export const formatKillRecordBossLabel = (killRecord?: KillRecord, tier?: ProgressionTier | null) => {
  if (!killRecord) {
    return "";
  }

  return tierDisplaysDifficulties(tier) ? `${killRecord.bossName} ${killRecord.difficultyName}` : killRecord.bossName;
};

const getBossSortOrder = (raid: ProgressionRaid, boss: ProgressionBoss) => {
  const raidKey = normalizeProgressionName(raid.name);
  const encounterOrder = bossEncounterOrders.get(raidKey);

  if (typeof boss.encounterId === "number" && encounterOrder?.has(boss.encounterId)) {
    return encounterOrder.get(boss.encounterId) ?? Number.POSITIVE_INFINITY;
  }

  return bossNameOrders.get(raidKey)?.get(normalizeProgressionName(boss.name)) ?? Number.POSITIVE_INFINITY;
};

export const getSortedBosses = (raid: ProgressionRaid) =>
  [...(raid.bosses ?? [])].sort(
    (a, b) =>
      getBossSortOrder(raid, a) - getBossSortOrder(raid, b) ||
      (a.encounterId ?? Number.POSITIVE_INFINITY) - (b.encounterId ?? Number.POSITIVE_INFINITY) ||
      (a.name || "").localeCompare(b.name || ""),
  );
