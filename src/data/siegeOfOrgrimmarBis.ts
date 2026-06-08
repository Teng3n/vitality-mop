export const SIEGE_OF_ORGRIMMAR_BOSSES = [
  "Immerseus",
  "Fallen Protectors",
  "Norushen",
  "Sha of Pride",
  "Galakras",
  "Iron Juggernaut",
  "Kor'kron Dark Shaman",
  "General Nazgrim",
  "Malkorok",
  "Spoils of Pandaria",
  "Thok the Bloodthirsty",
  "Siegecrafter Blackfuse",
  "Paragons of the Klaxxi",
  "Garrosh Hellscream",
] as const;

export const BIS_SLOT_ORDER = [
  "Head",
  "Neck",
  "Shoulder",
  "Back",
  "Chest",
  "Wrist",
  "Hands",
  "Waist",
  "Legs",
  "Feet",
  "Finger 1",
  "Finger 2",
  "Trinket 1",
  "Trinket 2",
  "Main Hand",
  "Off Hand",
  "Two-Hand",
  "Ranged",
] as const;

export type BisSlot = (typeof BIS_SLOT_ORDER)[number];

export interface BisSpec {
  className: string;
  spec: string;
  role: string;
}

export interface BisItem {
  item: string;
  slot: BisSlot;
  boss: string;
}

export interface BisSpecList extends BisSpec {
  items: BisItem[];
}

const tierTokenByClass = {
  "Death Knight": "Vanquisher",
  Druid: "Vanquisher",
  Mage: "Vanquisher",
  Rogue: "Vanquisher",
  Paladin: "Conqueror",
  Priest: "Conqueror",
  Warlock: "Conqueror",
  Hunter: "Protector",
  Monk: "Protector",
  Shaman: "Protector",
  Warrior: "Protector",
} as const;

const tierItemBySlot = {
  Head: { boss: "Thok the Bloodthirsty", prefix: "Helm" },
  Shoulder: { boss: "Siegecrafter Blackfuse", prefix: "Shoulders" },
  Chest: { boss: "Sha of Pride", prefix: "Chest" },
  Hands: { boss: "General Nazgrim", prefix: "Gauntlets" },
  Legs: { boss: "Paragons of the Klaxxi", prefix: "Leggings" },
} as const;

const tokenName = (className: keyof typeof tierTokenByClass, slot: keyof typeof tierItemBySlot) => {
  const tier = tierTokenByClass[className];
  const item = tierItemBySlot[slot];
  return {
    item: `${item.prefix} of the Cursed ${tier}`,
    slot,
    boss: item.boss,
  };
};

const tier = (className: keyof typeof tierTokenByClass): BisItem[] => [
  tokenName(className, "Head"),
  tokenName(className, "Shoulder"),
  tokenName(className, "Chest"),
  tokenName(className, "Hands"),
  tokenName(className, "Legs"),
];

const item = (name: string, slot: BisSlot, boss: string): BisItem => ({ item: name, slot, boss });

const capItemsPerSlot = (items: BisItem[], maxPerSlot = 2) => {
  const slotCounts = new Map<BisSlot, number>();

  return items.filter((bisItem) => {
    const count = slotCounts.get(bisItem.slot) ?? 0;

    if (count >= maxPerSlot) {
      return false;
    }

    slotCounts.set(bisItem.slot, count + 1);
    return true;
  });
};

const base: BisSpec[] = [
  { className: "Death Knight", spec: "Blood", role: "Tank" },
  { className: "Death Knight", spec: "Frost", role: "Melee DPS" },
  { className: "Death Knight", spec: "Unholy", role: "Melee DPS" },
  { className: "Druid", spec: "Balance", role: "Ranged DPS" },
  { className: "Druid", spec: "Feral", role: "Melee DPS" },
  { className: "Druid", spec: "Guardian", role: "Tank" },
  { className: "Druid", spec: "Restoration", role: "Healer" },
  { className: "Hunter", spec: "Beast Mastery", role: "Ranged DPS" },
  { className: "Hunter", spec: "Marksmanship", role: "Ranged DPS" },
  { className: "Hunter", spec: "Survival", role: "Ranged DPS" },
  { className: "Mage", spec: "Arcane", role: "Ranged DPS" },
  { className: "Mage", spec: "Fire", role: "Ranged DPS" },
  { className: "Mage", spec: "Frost", role: "Ranged DPS" },
  { className: "Monk", spec: "Brewmaster", role: "Tank" },
  { className: "Monk", spec: "Mistweaver", role: "Healer" },
  { className: "Monk", spec: "Windwalker", role: "Melee DPS" },
  { className: "Paladin", spec: "Holy", role: "Healer" },
  { className: "Paladin", spec: "Protection", role: "Tank" },
  { className: "Paladin", spec: "Retribution", role: "Melee DPS" },
  { className: "Priest", spec: "Discipline", role: "Healer" },
  { className: "Priest", spec: "Holy", role: "Healer" },
  { className: "Priest", spec: "Shadow", role: "Ranged DPS" },
  { className: "Rogue", spec: "Assassination", role: "Melee DPS" },
  { className: "Rogue", spec: "Combat", role: "Melee DPS" },
  { className: "Rogue", spec: "Subtlety", role: "Melee DPS" },
  { className: "Shaman", spec: "Elemental", role: "Ranged DPS" },
  { className: "Shaman", spec: "Enhancement", role: "Melee DPS" },
  { className: "Shaman", spec: "Restoration", role: "Healer" },
  { className: "Warlock", spec: "Affliction", role: "Ranged DPS" },
  { className: "Warlock", spec: "Demonology", role: "Ranged DPS" },
  { className: "Warlock", spec: "Destruction", role: "Ranged DPS" },
  { className: "Warrior", spec: "Arms", role: "Melee DPS" },
  { className: "Warrior", spec: "Fury", role: "Melee DPS" },
  { className: "Warrior", spec: "Protection", role: "Tank" },
];

const casterDps = [
  item("Purified Bindings of Immerseus", "Trinket 1", "Immerseus"),
  item("Kardris' Toxic Totem", "Trinket 2", "Kor'kron Dark Shaman"),
  item("Dysmorphic Samophlange of Discontinuity", "Trinket 2", "Siegecrafter Blackfuse"),
  item("Black Blood of Y'Shaarj", "Trinket 2", "Garrosh Hellscream"),
  item("Extinguished Ember of Galakras", "Finger 1", "Galakras"),
  item("Juggernaut's Power Core", "Off Hand", "Iron Juggernaut"),
  item("Arcweaver Spell Sword", "Main Hand", "General Nazgrim"),
  item("Lever of the Megantholithic Apparatus", "Two-Hand", "Siegecrafter Blackfuse"),
  item("Kor'kron Spire of Supremacy", "Two-Hand", "Garrosh Hellscream"),
  item("Hellscream's War Staff", "Two-Hand", "Garrosh Hellscream"),
];

const spiritCaster = [
  item("Gaze of Arrogance", "Two-Hand", "Sha of Pride"),
  item("Drakebinder Greatstaff", "Two-Hand", "Galakras"),
  item("Kardris' Scepter", "Main Hand", "Kor'kron Dark Shaman"),
  item("Purehearted Cricket Cage", "Off Hand", "Fallen Protectors"),
  item("Festering Primordial Globule", "Off Hand", "Thok the Bloodthirsty"),
  item("Revelations of Y'Shaarj", "Off Hand", "Garrosh Hellscream"),
];

const healer = [
  item("Prismatic Prison of Pride", "Trinket 1", "Sha of Pride"),
  item("Nazgrim's Burnished Insignia", "Trinket 2", "General Nazgrim"),
  item("Norushen's Enigmatic Barrier", "Off Hand", "Norushen"),
  item("Festering Primordial Globule", "Off Hand", "Thok the Bloodthirsty"),
  item("Siegecrafter's Forge Hammer", "Main Hand", "Siegecrafter Blackfuse"),
  item("Revelations of Y'Shaarj", "Off Hand", "Garrosh Hellscream"),
];

const agility = [
  item("Assurance of Consequence", "Trinket 1", "Sha of Pride"),
  item("Haromm's Talisman", "Trinket 2", "Kor'kron Dark Shaman"),
  item("Sigil of Rampage", "Trinket 2", "Spoils of Pandaria"),
  item("Thok's Acid-Grooved Tooth", "Trinket 2", "Thok the Bloodthirsty"),
  item("Ticking Ebon Detonator", "Trinket 2", "Siegecrafter Blackfuse"),
  item("Immerseus' Crystalline Eye", "Neck", "Immerseus"),
];

const strengthDps = [
  item("Fusion-Fire Core", "Trinket 1", "Norushen"),
  item("Evil Eye of Galakras", "Trinket 2", "Galakras"),
  item("Thok's Tail Tip", "Trinket 2", "Thok the Bloodthirsty"),
  item("Frenzied Crystal of Rage", "Trinket 2", "Malkorok"),
  item("Greatsword of Pride's Fall", "Two-Hand", "Sha of Pride"),
  item("Gar'tok, Strength of the Faithful", "Two-Hand", "General Nazgrim"),
  item("Xal'atoh, Desecrated Image of Gorehowl", "Two-Hand", "Garrosh Hellscream"),
  item("Hellscream's Decapitator", "Two-Hand", "Garrosh Hellscream"),
];

const tank = [
  item("Rook's Unlucky Talisman", "Trinket 1", "Fallen Protectors"),
  item("Juggernaut's Focusing Crystal", "Trinket 2", "Iron Juggernaut"),
  item("Vial of Living Corruption", "Trinket 2", "Malkorok"),
  item("Curse of Hubris", "Trinket 2", "Garrosh Hellscream"),
  item("Encapsulated Essence of Immerseus", "Main Hand", "Immerseus"),
  item("Xifeng, Longblade of the Titanic Guardian", "Main Hand", "Norushen"),
];

const shieldTank = [
  ...tank,
  item("Shield of Mockery", "Off Hand", "Sha of Pride"),
  item("Bulwark of the Fallen General", "Off Hand", "General Nazgrim"),
  item("Visage of the Monstrous", "Off Hand", "Malkorok"),
  item("Ancient Mogu Tower Shield", "Off Hand", "Spoils of Pandaria"),
  item("Hellscream's Barrier", "Off Hand", "Garrosh Hellscream"),
  item("Hellscream's Shield Wall", "Off Hand", "Garrosh Hellscream"),
];

const twoHandTank = [
  item("Rook's Unlucky Talisman", "Trinket 1", "Fallen Protectors"),
  item("Juggernaut's Focusing Crystal", "Trinket 2", "Iron Juggernaut"),
  item("Vial of Living Corruption", "Trinket 2", "Malkorok"),
  item("Curse of Hubris", "Trinket 2", "Garrosh Hellscream"),
];

const specItems: Record<string, BisItem[]> = {
  "Affliction Warlock": [...tier("Warlock"), ...casterDps],
  "Demonology Warlock": [...tier("Warlock"), ...casterDps],
  "Destruction Warlock": [...tier("Warlock"), ...casterDps],
  "Arcane Mage": [...tier("Mage"), ...casterDps],
  "Fire Mage": [...tier("Mage"), ...casterDps],
  "Frost Mage": [...tier("Mage"), ...casterDps],
  "Balance Druid": [...tier("Druid"), ...casterDps, ...spiritCaster],
  "Shadow Priest": [...tier("Priest"), ...casterDps, ...spiritCaster],
  "Elemental Shaman": [...tier("Shaman"), ...casterDps, ...spiritCaster],
  "Discipline Priest": [...tier("Priest"), ...healer, ...spiritCaster],
  "Holy Priest": [...tier("Priest"), ...healer, ...spiritCaster],
  "Holy Paladin": [...tier("Paladin"), ...healer, item("Kardris' Scepter", "Main Hand", "Kor'kron Dark Shaman")],
  "Restoration Druid": [...tier("Druid"), ...healer, ...spiritCaster],
  "Restoration Shaman": [...tier("Shaman"), ...healer, ...spiritCaster],
  "Mistweaver Monk": [...tier("Monk"), ...healer, ...spiritCaster],
  "Survival Hunter": [
    ...tier("Hunter"),
    ...agility,
    item("Death Lotus Crossbow", "Ranged", "Fallen Protectors"),
    item("Dagryn's Discarded Longbow", "Ranged", "Galakras"),
    item("Kor'kron Hand Cannon", "Ranged", "Malkorok"),
    item("Hisek's Reserve Longbow", "Ranged", "Paragons of the Klaxxi"),
    item("Hellscream's Warbow", "Ranged", "Garrosh Hellscream"),
  ],
  "Beast Mastery Hunter": [],
  "Marksmanship Hunter": [],
  "Feral Druid": [...tier("Druid"), ...agility, item("Trident of Corrupted Waters", "Two-Hand", "Immerseus"), item("Halberd of Inner Shadows", "Two-Hand", "Malkorok"), item("Britomart's Jagged Pike", "Two-Hand", "Thok the Bloodthirsty"), item("Hellscream's Pig Sticker", "Two-Hand", "Garrosh Hellscream")],
  "Windwalker Monk": [...tier("Monk"), ...agility, item("Trident of Corrupted Waters", "Two-Hand", "Immerseus"), item("Softfoot's Last Resort", "Main Hand", "Fallen Protectors"), item("Seismic Bore", "Main Hand", "Iron Juggernaut"), item("Halberd of Inner Shadows", "Two-Hand", "Malkorok")],
  "Subtlety Rogue": [...tier("Rogue"), ...agility, item("Norushen's Shortblade", "Main Hand", "Norushen"), item("Softfoot's Last Resort", "Main Hand", "Fallen Protectors"), item("Seismic Bore", "Main Hand", "Iron Juggernaut"), item("Nazgrim's Gutripper", "Main Hand", "General Nazgrim"), item("Rik'kal's Bloody Scalpel", "Main Hand", "Paragons of the Klaxxi"), item("Hellscream's Razor", "Main Hand", "Garrosh Hellscream")],
  "Assassination Rogue": [],
  "Combat Rogue": [],
  "Enhancement Shaman": [...tier("Shaman"), ...agility, item("Softfoot's Last Resort", "Main Hand", "Fallen Protectors"), item("Seismic Bore", "Main Hand", "Iron Juggernaut"), item("Haromm's Frozen Crescent", "Main Hand", "Kor'kron Dark Shaman"), item("Malkorok's Skullcleaver", "Main Hand", "Malkorok"), item("Korven's Crimson Crescent", "Main Hand", "Paragons of the Klaxxi"), item("Hellscream's Cleaver", "Main Hand", "Garrosh Hellscream")],
  "Arms Warrior": [...tier("Warrior"), ...strengthDps],
  "Fury Warrior": [...tier("Warrior"), ...strengthDps, item("Hellscream's Cleaver", "Main Hand", "Garrosh Hellscream")],
  "Unholy Death Knight": [...tier("Death Knight"), ...strengthDps],
  "Frost Death Knight": [...tier("Death Knight"), ...strengthDps, item("Hellscream's Cleaver", "Main Hand", "Garrosh Hellscream")],
  "Retribution Paladin": [...tier("Paladin"), ...strengthDps],
  "Protection Paladin": [...tier("Paladin"), ...shieldTank, item("Haromm's Frozen Crescent", "Main Hand", "Kor'kron Dark Shaman")],
  "Protection Warrior": [...tier("Warrior"), ...shieldTank, item("Haromm's Frozen Crescent", "Main Hand", "Kor'kron Dark Shaman")],
  "Blood Death Knight": [...tier("Death Knight"), ...twoHandTank, item("Xal'atoh, Desecrated Image of Gorehowl", "Two-Hand", "Garrosh Hellscream")],
  "Guardian Druid": [...tier("Druid"), ...twoHandTank, item("Trident of Corrupted Waters", "Two-Hand", "Immerseus")],
  "Brewmaster Monk": [...tier("Monk"), ...twoHandTank, item("Trident of Corrupted Waters", "Two-Hand", "Immerseus")],
};

export const SIEGE_OF_ORGRIMMAR_BIS_LISTS: BisSpecList[] = base.map((spec) => ({
  ...spec,
  items: capItemsPerSlot(specItems[`${spec.spec} ${spec.className}`] ?? []),
}));
