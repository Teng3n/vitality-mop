type RoleKey = "tanks" | "healers" | "dps" | "everyone" | "heroic";

export type SiegeBossGuide = {
  name: string;
  slug: string;
  sections: Record<RoleKey, string[]>;
};

export const siegeOfOrgrimmarBossGuides: SiegeBossGuide[] = [
  {
    name: "Immerseus",
    slug: "immerseus",
    sections: {
      tanks: [
        "Tank Immerseus facing away from the raid.",
        "Tank swap for Corrosive Blast."
      ],
      healers: [
        "Heal Contaminated Puddles during Split.",
        "Stand within 12 yards of Contaminated Puddles as they reach full health for the healing and mana buff.",
        "Heal raid damage when puddles reach the center during Split.",
        "Watch raid-wide Sha Bolt damage during the Immerseus phase."
      ],
      dps: [
        "Damage Sha Puddles during Split.",
        "Stand within 10 yards of Sha Puddles as they die for the stacking damage buff."
      ],
      everyone: [
        "Avoid Sha Bolt void zones.",
        "Avoid Swirl and the moving void zones it creates.",
        "Do not stand in front of Immerseus during Swirl.",
        "Do not enter Immerseus' hitbox.",
        "Spread evenly around the room during Split so puddles can be reached."
      ],
      heroic: [
        "Swelling Corruption is applied during the Immerseus phase.",
        "Each attack into Swelling Corruption removes a stack, applies a dispellable Shadow DoT to the attacker, and spawns a Congealed Sha.",
        "Kill Congealed Sha adds quickly.",
        "A tank should pick up Congealed Sha adds.",
        "Sha Pool appears in the center during Split and grows when puddles reach it."
      ]
    }
  },
  {
    name: "Fallen Protectors",
    slug: "fallen-protectors",
    sections: {
      tanks: [
        "Face Rook Stonetoe away from the raid for Vengeful Strikes.",
        "Pick up Embodied Misery, Embodied Sorrow, and Embodied Gloom during Rook's Desperate Measures.",
        "Kite Embodied Misery away from the void zones it creates.",
        "He Softfoot's tank should face away from He when Gouge is cast.",
        "He Softfoot's tank should watch Instant Poison damage and Noxious Poison void zones."
      ],
      healers: [
        "Watch Rook's tank during Vengeful Strikes.",
        "Heal the target of Mark of Anguish.",
        "Dispel Shadow Word: Bane before it ticks.",
        "Heal raid-wide Calamity damage.",
        "Heal Dark Meditation damage during Sun Tenderheart's Desperate Measures."
      ],
      dps: [
        "Prioritize Desperate Measures adds while they are active."
      ],
      everyone: [
        "Avoid Corrupted Brew.",
        "Move away from Rook during Corruption Kick.",
        "Stack for Inferno Strike.",
        "Interrupt Corruption Shock.",
        "Spread to reduce Sha Sear damage.",
        "Stack inside Meditative Field during Sun's Desperate Measures."
      ],
      heroic: [
        "Corrupted Brew projectiles travel faster the longer Rook is kept out of Desperate Measures.",
        "Rook's Desperate Measures adds share health.",
        "Debilitation from Mark of Anguish reduces armor by 80% for 4 minutes.",
        "Sun's Calamity deals 10% more maximum-health damage with each cast until Sun enters Desperate Measures.",
        "Use a Mark of Anguish pass rotation instead of letting one tank hold it indefinitely."
      ]
    }
  },
  {
    name: "Norushen",
    slug: "norushen",
    sections: {
      tanks: [
        "Tank swap on the Amalgam of Corruption.",
        "Pick up Unleashed Manifestations of Corruption.",
        "Soak assigned Residual Corruption void zones."
      ],
      healers: [
        "Heal increasing Icy Fear raid damage.",
        "Heal high raid damage while Unleashed Manifestations of Corruption are alive."
      ],
      dps: [
        "Prioritize adds whenever they are active."
      ],
      everyone: [
        "Avoid the Blind Hatred cutter beam.",
        "Intercept projectiles fired by Unleashed Essences of Corruption toward the Amalgam.",
        "Do not stand on a dying Unleashed Manifestation unless assigned to soak Residual Corruption.",
        "Complete your role's test."
      ],
      heroic: [
        "Heroic adds no new mechanics.",
        "Enemies have increased health and damage.",
        "The Normal-mode strategy remains unchanged."
      ]
    }
  },
  {
    name: "Sha of Pride",
    slug: "sha-of-pride",
    sections: {
      tanks: [
        "Tank swap when affected by Wounded Pride.",
        "The inactive tank should pick up Manifestations of Pride."
      ],
      healers: [
        "Dispel Mark of Arrogance while affected by Gift of the Titans.",
        "Heal Mark of Arrogance damage until it can be dispelled safely.",
        "Prepare for Unleashed damage after the boss reaches 30%."
      ],
      dps: [
        "Prioritize adds while they are alive.",
        "Interrupt Mocking Blast from Manifestations of Pride.",
        "Kill Reflections from Self-Reflection."
      ],
      everyone: [
        "Stack behind the boss on Normal mode.",
        "Handle the next Swelling Pride effect based on your Pride level.",
        "Avoid gaining unnecessary Pride.",
        "Do not stand on Corrupted Prison locations before Corrupted Prison is cast.",
        "Free Corrupted Prison targets immediately.",
        "Move to your Projection when required."
      ],
      heroic: [
        "Banishment sends selected players to the Sha Realm and leaves Corrupted Fragments in the normal realm.",
        "Kill Corrupted Fragments quickly to release banished players.",
        "Banished players must avoid the maze walls and hostile adds in the Sha Realm.",
        "Unstable Corruption creates Rifts of Corruption throughout the room.",
        "Close Rifts of Corruption only when not affected by Weakened Resolve.",
        "Do not close a Rift while affected by Mark of Arrogance."
      ]
    }
  },
  {
    name: "Galakras",
    slug: "galakras",
    sections: {
      tanks: [
        "Tank all mobs that enter the fight.",
        "Move Korgra away from her void zones.",
        "Face High Enforcer Thranok away from the raid.",
        "Tank Galakras in Phase Two and perform a tank switch."
      ],
      healers: [
        "Expect many sources of raid damage during Phase One.",
        "In Phase Two, heal increasing Pulsing Flames damage.",
        "In Phase Two, heal Flames of Galakrond explosion damage."
      ],
      dps: [
        "Kill Kor'kron Demolishers.",
        "Kill Healing Tide Totems.",
        "Send assigned players to tower mini-bosses.",
        "Use Anti-Air Turrets against Proto-Drakes."
      ],
      everyone: [
        "Avoid Arcing Smash.",
        "Avoid Muzzle Spray.",
        "Move away from Dragonmaw Ebon Stalkers if they are behind you.",
        "Move away from High Enforcer Thranok during Skull Cracker.",
        "Intercept Flames of Galakrond in Phase Two."
      ],
      heroic: [
        "Heroic adds friendly NPCs that unlock the towers instead of the towers opening automatically.",
        "Protect the tower-opening NPCs from Dragonmaw Grunts.",
        "If a tower-opening NPC dies, a new NPC spawns and tower-opening progress restarts.",
        "Assign DPS players to protect the NPC opening the next tower."
      ]
    }
  },
  {
    name: "Iron Juggernaut",
    slug: "iron-juggernaut",
    sections: {
      tanks: [
        "Tank swap for Flame Vents during Assault Phase.",
        "Face Iron Juggernaut away from the raid during Assault Phase.",
        "Detonate Crawler Mines if assigned."
      ],
      healers: [
        "Heal random raid damage from Laser Burn.",
        "Heal the tank detonating Crawler Mines.",
        "Prepare for Seismic Activity during Siege Phase.",
        "Prepare for Demolisher Cannons during Siege Phase."
      ],
      dps: [],
      everyone: [
        "Avoid Borer Drill ground effects.",
        "Avoid Mortar Cannon ground effects.",
        "During Siege Phase, do not stand where Shock Pulse can knock you too far away.",
        "If targeted by Cutter Laser, do not kite it into Explosive Tar."
      ],
      heroic: [
        "Heroic adds Ricochet during Assault Phase.",
        "Ricochet creates fast-moving sawblades near ranged players.",
        "Ranged players spread slightly so Ricochet sawblades hit fewer players.",
        "Mortar Barrage is added during Siege Phase.",
        "Mortar Barrage marks random ground near the boss with red circles.",
        "Players targeted by Cutter Laser during the Siege Phase stack strategy must move out of the raid quickly."
      ]
    }
  },
  {
    name: "Kor'kron Dark Shaman",
    slug: "korkron-dark-shaman",
    sections: {
      tanks: [
        "Pick up the bosses and their mounts at the start.",
        "Face Darkfang and Bloodclaw away from the raid until they die.",
        "Tank swap on the bosses.",
        "Tank the bosses together so the raid can cleave them.",
        "Move the bosses away from Ashen Wall.",
        "If assigned, kite Foul Slimes so they do not pass through the raid."
      ],
      healers: [
        "Heal Toxic Mist targets as the DoT ramps up.",
        "Heal raid damage from Falling Ash.",
        "Use defensive raid cooldowns when the bosses drop below 25% health."
      ],
      dps: [
        "Kill Darkfang and Bloodclaw first.",
        "Cleave or multi-DoT the bosses when it is a DPS gain, because they share health.",
        "Ranged DPS should kill Foul Slimes immediately.",
        "If assigned, kite Foul Slimes until they die."
      ],
      everyone: [
        "Move out of Foul Stream.",
        "Move out of Falling Ash.",
        "Move away from Ashen Wall.",
        "Avoid Toxic Storm clouds and Toxic Tornadoes.",
        "Do not stand near Wavebinder Kardris during Foul Geyser."
      ],
      heroic: [
        "Earthbreaker Haromm gains Iron Tomb at 95% health.",
        "Iron Tomb creates a stationary tomb at a random player's location and damages players within 3 yards.",
        "Wavebinder Kardris gains Iron Prison at 95% health.",
        "Iron Prison deals 100% of the target's maximum health as Physical damage when it expires.",
        "Iron Prison targets need full health plus a defensive cooldown or absorption effect before expiration.",
        "Spread at least 3 yards for Iron Tomb."
      ]
    }
  },
  {
    name: "General Nazgrim",
    slug: "general-nazgrim",
    sections: {
      tanks: [
        "Tank swap for Sundering Blow.",
        "Tank mobs away from Healing Tide Totems.",
        "Tank mobs away from Ravager weapons."
      ],
      healers: [
        "Use cooldowns for War Song if needed.",
        "Pay special attention to Bonecracker targets."
      ],
      dps: [
        "Prioritize adds over Nazgrim.",
        "Kill Kor'kron Banners immediately.",
        "Kill Healing Tide Totems immediately.",
        "Do not attack Nazgrim during Defensive Stance."
      ],
      everyone: [
        "Interrupt adds as much as possible.",
        "Do not allow Magistrike casts from Kor'kron Arcweavers.",
        "Do not allow Empowered Chain Heal casts from Kor'kron Warshamans.",
        "Dispel Earth Shield immediately.",
        "Avoid Aftershock, Ravager, and Ironstorm damage."
      ],
      heroic: [
        "Nazgrim casts Execute on his current tank every 15 seconds.",
        "Kor'kron Snipers are added to add waves.",
        "Kor'kron Snipers use Hunter's Mark on random non-tank players.",
        "Sniper targets should face the Sniper away from the raid to reduce Multi-Shot damage.",
        "Heroic add waves contain 3 adds instead of 2."
      ]
    }
  },
  {
    name: "Malkorok",
    slug: "malkorok",
    sections: {
      tanks: [
        "Tank swap for Fatal Strike."
      ],
      healers: [
        "Keep Ancient Miasma shields at maximum capacity.",
        "Dispel Displaced Energy when the target is out of the raid, if the raid strategy calls for it."
      ],
      dps: [],
      everyone: [
        "Spread during Might of the Kor'kron.",
        "Stack during Blood Rage.",
        "Soak Imploding Energy if assigned.",
        "Track Arcing Smash locations.",
        "Avoid Breath of Y'Shaarj in the Arcing Smash locations."
      ],
      heroic: [
        "Orbs of Corruption spawn during Might of the Kor'kron.",
        "Touching an Orb of Corruption removes the player's Ancient Miasma shield and deals Shadow damage.",
        "Living Corruption adds spawn during Might of the Kor'kron.",
        "Living Corruption reduces movement and casting speed within 8 yards by 75%.",
        "Kill Living Corruption adds quickly.",
        "Displaced Energy also roots its target during Blood Rage."
      ]
    }
  },
  {
    name: "Spoils of Pandaria",
    slug: "spoils-of-pandaria",
    sections: {
      tanks: [
        "Pick up mobs that spawn in your quadrant.",
        "Move mobs out of void zones that heal them or buff their damage.",
        "Kite Kor'thik Warcallers when they become Enraged."
      ],
      healers: [
        "Face as many raid members as possible while using the Wise Mistweaver Spirit buff.",
        "Dispel Torment.",
        "Dispel other harmful debuffs whenever possible."
      ],
      dps: [
        "Damage adds using cleave and multi-DoT when useful.",
        "Follow the raid leader's kill order.",
        "Prioritize the most dangerous enemies."
      ],
      everyone: [
        "Spread when active adds require it.",
        "If affected by Set to Blow, place bombs away from the raid's occupied area.",
        "Run away from Wise Mistweaver Spirit during Gusting Crane Kick.",
        "Avoid fiery blossoms from the Nameless Windwalker Spirit."
      ],
      heroic: [
        "Crimson Reconstitution void zones also deal Fire damage to players standing in them.",
        "Each cleared crate spawns one Unstable Spark in the other active quadrant.",
        "Unstable Sparks cast Supernova for 10 seconds.",
        "Supernova must not finish casting.",
        "Ranged DPS should switch to Unstable Sparks immediately.",
        "Heroic crate planning should minimize Unstable Spark spawns."
      ]
    }
  },
  {
    name: "Thok the Bloodthirsty",
    slug: "thok-the-bloodthirsty",
    sections: {
      tanks: [
        "Tank Thok so neither his head nor tail faces the raid.",
        "Tank swap and stay out of Thok's frontal cone until it is your turn to taunt.",
        "Pick up the Kor'kron Jailer during Phase Two."
      ],
      healers: [
        "Heal increasing Deafening Screech raid damage.",
        "Avoid casting when Deafening Screech goes off.",
        "Heal combined Deafening Screech and Shock Blast damage, or the ability replacing Shock Blast.",
        "Heal the Fixate target on Heroic."
      ],
      dps: [
        "Kill ice tombs.",
        "Kill the Kor'kron Jailer during Phase Two."
      ],
      everyone: [
        "Avoid standing in front of Thok.",
        "Avoid standing behind Thok.",
        "If focused during Phase Two, kite Thok in a predictable direction.",
        "Avoid fiery void zones during the Montak Phase One."
      ],
      heroic: [
        "Captive Cave Bats join during the second Phase One after the second Deafening Screech.",
        "The off-tank should pick up Captive Cave Bats.",
        "AoE Captive Cave Bats down quickly.",
        "Starved Yeti joins during the third Phase One after the second Deafening Screech.",
        "Avoid the Starved Yeti's path.",
        "Thok heals when he kills an NPC during Phase Two.",
        "The Fixate target takes damage during Phase Two."
      ]
    }
  },
  {
    name: "Siegecrafter Blackfuse",
    slug: "siegecrafter-blackfuse",
    sections: {
      tanks: [
        "Tank swap on Siegecrafter Blackfuse.",
        "Tank swap on Automated Shredders.",
        "Take Automated Shredders at least 35 yards away from Blackfuse.",
        "Watch Blackfuse's Protective Frenzy damage after an add dies."
      ],
      healers: [
        "Heal increased tank damage from Protective Frenzy after an add dies.",
        "Heal raid damage from Overload."
      ],
      dps: [
        "Damage Crawler Mines when they are alive.",
        "Damage Siegecrafter Blackfuse when no Crawler Mines are alive.",
        "If assigned, use the north-western conveyor belt and kill the designated add."
      ],
      everyone: [
        "If fixated by Crawler Mines, do not let them reach you.",
        "Do not kite Crawler Mines within 35 yards of Blackfuse.",
        "Avoid trapping players between sawblades and Superheated void zones.",
        "Avoid Shockwave Missile waves."
      ],
      heroic: [
        "One surviving conveyor weapon becomes Overcharged each wave.",
        "Overcharged Electromagnets alternate pulling and pushing players and sawblades.",
        "Overcharged Crawler Mines spawn two larger Crawler Mines that split into smaller mines when killed.",
        "Overcharged Missile Turrets summon three Missile Turret NPCs that must be killed in sequence.",
        "Overcharged Laser Turrets create three concentric fire rings with safe gaps.",
        "Matter Purification Beam gaps on the north-western conveyor belt change position."
      ]
    }
  },
  {
    name: "Paragons of the Klaxxi",
    slug: "paragons-of-the-klaxxi",
    sections: {
      tanks: [
        "Use active mitigation to avoid debuffs from Rik'kal and Xaril.",
        "Do not tank bosses you are prevented from tanking by Hewn or Exposed Veins.",
        "Prepare for Gouge and Mutilate.",
        "Prepare for Shield Bash and Vicious Assault.",
        "Face Korven the Prime away from the raid."
      ],
      healers: [
        "Watch burst tank damage from Gouge and Mutilate.",
        "Watch burst tank damage from Shield Bash and Vicious Assault.",
        "Heal players transformed into Amber Scorpions.",
        "Heal Amber Parasite targets.",
        "Do not let players sit below 25% health while Iyyokuk the Lucid is alive."
      ],
      dps: [
        "Switch promptly to amber blocks.",
        "Switch promptly to Hungry Kunchongs.",
        "Switch promptly to Bloods.",
        "Switch promptly to Amber Parasites.",
        "Do not multi-DoT or cleave secondary Paragons."
      ],
      everyone: [
        "Soak Aim by forming a line between the target and Hisek.",
        "Avoid Death from Above impact zones.",
        "Break Mesmerize by damaging the active Hungry Kunchong."
      ],
      heroic: [
        "Skeer summons one additional Blood.",
        "Rik'kal's Amber Scorpion players must use Prey on an Amber Parasite to exit the form or die.",
        "Hisek gains Rapid Fire.",
        "Korven's Encase in Amber block cannot be killed by raid members.",
        "Kaz'tik's Mesmerize still requires breaking the active Hungry Kunchong quickly.",
        "Iyyokuk's Fiery Edge links each target to two other players and selects more targets.",
        "Xaril triggers orange, purple, and green Toxic Injection effects instead of red, blue, and yellow.",
        "Kil'ruk gains Reave, pulling players toward him during the channel.",
        "Active Paragons gain 8% increased damage every 50 seconds instead of gaining damage when another Paragon dies."
      ]
    }
  },
  {
    name: "Garrosh Hellscream",
    slug: "garrosh-hellscream",
    sections: {
      tanks: [
        "In Phase One, one tank takes Garrosh and the other takes the adds.",
        "In Phases Two and Three, tank swap on Garrosh.",
        "Pick up Minions of Y'Shaarj in Phases Two and Three."
      ],
      healers: [
        "Heal raid damage from Iron Star explosions in Phase One.",
        "Heal Annihilate damage in the realm of Y'Shaarj.",
        "Heal Empowered Gripping Despair tank damage in Phases Two and Three.",
        "Heal Whirling Corruption raid damage in Phases Two and Three."
      ],
      dps: [
        "Kill Farseer Wolf Riders as soon as they appear.",
        "DoT and kill Desecrated Weapons in Phase One.",
        "Damage mind-controlled players.",
        "Kill Minions of Y'Shaarj away from other Minions."
      ],
      everyone: [
        "Do not interrupt Farseer Wolf Riders' Chain Lightning in Phase One.",
        "Do not get hit by Iron Stars in Phase One.",
        "In the realm of Y'Shaarj, stand near adds as they die.",
        "In the realm of Y'Shaarj, avoid Annihilate.",
        "Stay away from Garrosh during Whirling Corruption.",
        "Interrupt and damage players affected by Touch of Y'Shaarj."
      ],
      heroic: [
        "Kor'kron Warbringers fixate raid members during Phase One.",
        "Transition realms occur in a fixed order and have additional mechanics.",
        "Temple of the Jade Serpent adds cast interruptible Embodied Doubt.",
        "Terrace of Endless Spring adds cause Crushing Fear void zones while alive.",
        "Minions of Y'Shaarj gain energy from melee attacks and cast Empowering Corruption at 100 energy.",
        "Heroic adds Phase Four in Stormwind after Garrosh reaches 0% health.",
        "Phase Four includes Malice, Bombardment, Iron Star checks, and Manifest Rage."
      ]
    }
  }
];
