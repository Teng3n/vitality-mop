type RoleKey = "tanks" | "healers" | "dps" | "everyone" | "heroic";

export type SiegeBossGuide = {
  name: string;
  slug: string;
  phase: string;
  sections: Record<RoleKey, string[]>;
  wipes: string[];
  reminder: string;
};

export const siegeOfOrgrimmarBossGuides: SiegeBossGuide[] = [
  {
    name: "Immerseus",
    slug: "immerseus",
    phase: "Split room evenly. Kill or heal puddles before they reach the center.",
    sections: {
      tanks: [
        "Swap after Corrosive Blast and keep the cone faced away from the raid.",
        "Do not try to reposition the boss. Immerseus is stationary in the center of the room.",
        "During Split, help control nearby Sha Puddles if your active tank duties are clear.",
        "Heroic: pick up Congealed Sha adds spawned by Swelling Corruption and keep them off healers."
      ],
      healers: [
        "During Split, heal Contaminated Puddles to full before they reach Immerseus.",
        "Top players after puddles reach the center, because each remaining puddle causes raid damage.",
        "Stand near fully healed Contaminated Puddles when possible to gain their healing buff.",
        "Plan raid cooldowns for bad Split waves with several puddles reaching the center."
      ],
      dps: [
        "Kill Sha Puddles during Split before they reach Immerseus.",
        "Stand near killed Sha Puddles when possible to gain their damage buff.",
        "Do not chase damage on Immerseus while puddles are active. Puddle control is the kill condition.",
        "Heroic: control boss damage during Swelling Corruption and swap to spawned Congealed Sha adds."
      ],
      everyone: [
        "Spread around the circular room so every Split lane has coverage.",
        "Move out of Sha Bolt pools and do not stand in Seeping Sha near the center.",
        "Dodge Swirl and the moving water streams during the boss phase.",
        "Killed or healed puddles remove corruption. Puddles that reach the center damage the raid."
      ],
      heroic: [
        "Swelling Corruption causes attacks against Immerseus to remove stacks and spawn Congealed Sha adds.",
        "Assign DPS to throttle boss hits when add stacks are high, then kill spawned adds quickly.",
        "Tanks should be ready for add pickups during Swelling Corruption windows.",
        "Heroic still revolves around clean Split waves. Extra boss damage does not replace puddle control."
      ]
    },
    wipes: [
      "Corrosive Blast pointed into the raid.",
      "Puddles reaching the center because Split assignments are uneven.",
      "Players standing in Swirl paths or Sha Bolt pools.",
      "Heroic Congealed Sha adds living too long after Swelling Corruption."
    ],
    reminder: "Spread around the room, face Corrosive Blast away, dodge Swirl and pools, kill Sha Puddles, heal Contaminated Puddles, and control Heroic Swelling Corruption adds."
  },
  {
    name: "Fallen Protectors",
    slug: "fallen-protectors",
    phase: "Push Rook, He, and Sun through Desperate Measures cleanly. Do not push multiple bosses at once.",
    sections: {
      tanks: [
        "Tank Rook away from the raid and turn him for Vengeful Strikes.",
        "Turn away from He Softfoot when he casts Gouge or be incapacitated.",
        "Keep Rook's Desperate Measures adds controlled and pointed safely.",
        "Do not drag bosses through Sun's Dark Meditation barrier. Let the raid stack inside it."
      ],
      healers: [
        "Dispel Shadow Word: Bane quickly so it does not chain through the raid.",
        "Use healing cooldowns for Calamity, Corruption Shock, and Dark Meditation damage.",
        "Keep Garrote targets stable while He is active.",
        "On Heroic, prepare externals for Mark of Anguish carriers."
      ],
      dps: [
        "Follow the assigned health push order. Stop cleave if a second protector is close to Desperate Measures.",
        "Kill Embodied Misery, Sorrow, and Gloom during Sun's Desperate Measures.",
        "Kill Rook's Desperate Measures adds in the assigned order and interrupt when possible.",
        "Swap to He Softfoot's Mark of Anguish target on Heroic if the strategy calls for a fast transfer."
      ],
      everyone: [
        "Move out of Corrupted Brew impact zones.",
        "Stack inside Sun's Dark Meditation barrier during her Desperate Measures phase.",
        "Avoid Corruption Kick and do not stand in front of Rook during Vengeful Strikes.",
        "Do not accidentally push multiple protectors below 66% or 33% at the same time."
      ],
      heroic: [
        "Mark of Anguish is the main Heroic addition. Assign a transfer order before the pull.",
        "The Mark carrier takes heavy damage and can pass the debuff to another player with the extra action button.",
        "Keep Desperate Measures phases separated. Heroic damage punishes overlapping transitions hard.",
        "Use personal cooldowns when carrying Mark of Anguish or handling Desperate Measures mechanics."
      ]
    },
    wipes: [
      "Two Desperate Measures phases overlapping from uncontrolled cleave.",
      "Shadow Word: Bane bouncing because dispels were late.",
      "Raid members outside Sun's barrier during Dark Meditation.",
      "Heroic Mark of Anguish passed late or passed to an unprepared player."
    ],
    reminder: "Push one protector at a time, stack inside Sun's barrier, dispel Bane, dodge brew impacts, and use the assigned Heroic Mark of Anguish pass order."
  },
  {
    name: "Norushen",
    slug: "norushen",
    phase: "Cleanse players through trials, kill Manifestations, and burn the Amalgam before the room is overwhelmed.",
    sections: {
      tanks: [
        "Swap the Amalgam of Corruption for Self Doubt stacks.",
        "Enter tank trials on the assigned rotation and kill the trial add cleanly.",
        "Pick up Manifestations of Corruption that spawn from completed trials.",
        "Keep Manifestations controlled so their attacks do not hit non-tanks."
      ],
      healers: [
        "Send healers into trials early enough that the raid can keep up with Unleashed Anger and add damage.",
        "In healing trials, keep friendly NPCs alive and heal through corruption effects.",
        "Heal through Icy Fear, which ramps as the Amalgam's health drops.",
        "Stabilize the raid when Manifestations die and release Burst of Anger damage."
      ],
      dps: [
        "Enter DPS trials on assignment and kill trial adds quickly to become purified.",
        "Kill Manifestations of Corruption immediately after they spawn in the main room.",
        "Soak orbs from slain Manifestations if assigned so they do not pulse raid damage.",
        "Purified DPS should prioritize boss damage once main-room adds are controlled."
      ],
      everyone: [
        "Only assigned players click Look Within. Unplanned trial entries disrupt the cleanse order.",
        "Avoid Blind Hatred as it sweeps around the room.",
        "Do not ignore small adds. Uncontrolled corruption adds quickly overwhelm the raid.",
        "Use personals late in the fight as Icy Fear ramps."
      ],
      heroic: [
        "Heroic uses the same core trial structure with stricter damage, healing, and timing checks.",
        "Trial failures are much harder to recover from because the enrage timer is tighter.",
        "Keep the cleanse order disciplined. Sending too many of one role at once can leave the main room unstable.",
        "Purified players should not waste globals on avoidable mechanics. The fight is a throughput race."
      ]
    },
    wipes: [
      "Manifestations living too long after trials.",
      "Players entering trials out of order and leaving the main room short on a role.",
      "Blind Hatred clipping the raid.",
      "Late fight Icy Fear overwhelming healers because too few players were purified."
    ],
    reminder: "Follow the trial order, swap for Self Doubt, kill Manifestations, soak assigned corruption orbs, dodge Blind Hatred, and burn hard once purified."
  },
  {
    name: "Sha of Pride",
    slug: "sha-of-pride",
    phase: "Manage Pride levels, free prisons, and handle Swelling Pride mechanics before anyone reaches 100 Pride.",
    sections: {
      tanks: [
        "Swap after Wounded Pride. The tank with Wounded Pride should not take boss melee hits.",
        "Pick up Manifestations of Pride quickly and position them for interrupts.",
        "Interrupt Mocking Blast from Manifestations whenever possible.",
        "Be ready for heavy raid damage after Swelling Pride and Unleashed."
      ],
      healers: [
        "Dispel Mark of Arrogance when protected by Gift of the Titans or when the dispel is assigned.",
        "Prepare raid cooldowns for Swelling Pride and for the final Unleashed phase under 30% boss health.",
        "Heal players released from prisons and players hit by projection failures.",
        "Watch Pride levels. Emergency dispels can push players toward dangerous thresholds."
      ],
      dps: [
        "Kill Manifestations of Pride quickly and interrupt Mocking Blast.",
        "Kill Reflections after Swelling Pride spawns them.",
        "Break players out of Corrupted Prison immediately with assigned prison teams.",
        "Save cooldowns for the post-30% burn if the raid can reach it cleanly."
      ],
      everyone: [
        "Stand in your Projection before Swelling Pride resolves or you gain Pride and damage the raid.",
        "Move out of Bursting Pride and avoid standing near Manifestation death splashes if assigned away.",
        "Free prisoned players using the paired floor locks near each prison.",
        "At 100 Pride you become permanently mind controlled. Avoid avoidable Pride gains."
      ],
      heroic: [
        "Heroic adds Banishment. Banished players must navigate the Sha realm and return quickly.",
        "Rifts of Corruption appear around the room. Assigned players should close them safely.",
        "Heroic punishes Pride mistakes harder because extra mechanics create more opportunities to gain Pride.",
        "Keep prison, rift, and add assignments clear before the pull."
      ]
    },
    wipes: [
      "Tanks not swapping Wounded Pride.",
      "Projection failures during Swelling Pride.",
      "Prison teams reacting late.",
      "Manifestations casting Mocking Blast or living through Swelling Pride."
    ],
    reminder: "Swap Wounded Pride, interrupt and kill Manifestations, stand in Projections, free prisons immediately, and keep Pride low until the 30% burn."
  },
  {
    name: "Galakras",
    slug: "galakras",
    phase: "Win the ground phase, capture both towers, then split Flames of Galakrond during the dragon burn.",
    sections: {
      tanks: [
        "Tank ground adds away from the raid and pick up each wave quickly.",
        "Assign one tank to lead tower teams while the other controls ground adds.",
        "Interrupt and control Bonecrushers before they damage friendly NPCs.",
        "In phase two, keep Galakras stable while the raid handles Flames of Galakrond."
      ],
      healers: [
        "Watch friendly NPCs during Bonecrusher waves. If key NPCs die, the attempt can collapse.",
        "Assign healers between ground and tower teams before the pull.",
        "Use cooldowns for heavy add waves and for phase two pulsing raid damage.",
        "In phase two, stabilize players hit by Flames of Galakrond as the projectile passes through the raid."
      ],
      dps: [
        "Kill priority adds first: Bonecrushers, Shamans, Tidal Shamans, and tower threats.",
        "Interrupt Chain Heal and dangerous caster abilities whenever possible.",
        "Tower teams should clear the tower, kill the mini-boss, then use the cannon when both towers are ready.",
        "In phase two, stay aligned so Flames of Galakrond passes through enough players before impact."
      ],
      everyone: [
        "Do not stand in frontal cleaves, poison clouds, fire arrows, or tower ground effects.",
        "Move quickly between ground and tower assignments. Slow tower clears extend the dangerous add phase.",
        "Do not fire cannons early. Galakras is brought down when both towers are controlled.",
        "During phase two, keep enough spacing to share Flames of Galakrond without stacking every mechanic."
      ],
      heroic: [
        "Heroic adds tower demolition NPCs that must be protected so towers can be opened.",
        "Assign players to escort and protect demolition teams from incoming adds.",
        "Add waves hit harder, so interrupts and Bonecrusher control matter more.",
        "The phase two Flames of Galakrond chain remains the key raid execution check."
      ]
    },
    wipes: [
      "Bonecrushers killing friendly NPCs.",
      "Tower team moving too slowly or firing cannons before both towers are ready.",
      "Caster adds free-casting heals and raid damage.",
      "Phase two Flames of Galakrond not passing through enough players before impact."
    ],
    reminder: "Protect NPCs, kill priority adds, clear both towers, shoot Galakras down together, then line the raid so Flames of Galakrond is shared safely."
  },
  {
    name: "Iron Juggernaut",
    slug: "iron-juggernaut",
    phase: "Assault phase is mine and laser control. Siege phase is survival through knockbacks, tar, and cannon damage.",
    sections: {
      tanks: [
        "Swap for Flame Vents stacks during Assault Mode.",
        "Keep the boss steady during Assault Mode so the raid can place mines and lasers predictably.",
        "During Siege Mode, the boss is immobile. Focus on survival, knockback recovery, and mine assignments.",
        "Use strong cooldowns if assigned to soak Crawler Mines."
      ],
      healers: [
        "Prepare raid healing for Shock Pulse knockbacks and Demolisher Cannon damage.",
        "Keep mine soakers topped before they trigger Crawler Mines.",
        "Heal Laser Burn targets. The DoT is unavoidable and should not be confused with Cutter Laser movement.",
        "Use cooldowns during Siege Mode when Explosive Tar and cannon damage overlap."
      ],
      dps: [
        "Kill the boss while avoiding ground hazards. There are no add waves to pad on.",
        "Assigned players should detonate Crawler Mines before they expire.",
        "Move away from Mortar Cannon impact zones and Borer Drill spikes.",
        "Do not bait Cutter Laser through Explosive Tar or through other players."
      ],
      everyone: [
        "Dodge Borer Drill spikes, Mortar Cannon impacts, and Explosive Tar.",
        "During Siege Mode, brace for Shock Pulse knockbacks and avoid being pushed through hazards.",
        "If targeted by Cutter Laser, kite it away from the raid and away from tar patches.",
        "Keep clear of Crawler Mines unless you are assigned to soak them."
      ],
      heroic: [
        "Heroic adds Ricochet projectiles that bounce around the area. Avoid their path.",
        "Siege Mode includes heavier projectile and cannon pressure, so use personal cooldowns proactively.",
        "Mine soaking remains assigned work. Random players should not trigger mines.",
        "Movement discipline is the fight. Do not cross lasers, tar, mines, or projectile paths unnecessarily."
      ]
    },
    wipes: [
      "Crawler Mines expiring or being soaked by unprepared players.",
      "Cutter Laser dragged through tar or through the raid.",
      "Players knocked by Shock Pulse through stacked ground hazards.",
      "Standing in Mortar Cannon, Borer Drill, or Ricochet paths."
    ],
    reminder: "Swap Flame Vents, dodge drills and mortars, assigned players soak mines, kite Cutter Laser safely, and survive Siege Mode knockbacks without crossing tar or mines."
  },
  {
    name: "Kor'kron Dark Shaman",
    slug: "korkron-dark-shaman",
    phase: "Control Haromm and Kardris, manage ground effects, and keep raid movement planned as the room fills.",
    sections: {
      tanks: [
        "Split or stack the bosses according to the raid plan, but keep Foul Stream and Ashen Wall aimed safely.",
        "Move bosses out of bad ground without dragging them through the raid.",
        "Pick up Foul Slimes from Foul Geyser when your strategy calls for tank control.",
        "Heroic: handle Iron Prison and Iron Tomb assignments with planned cooldowns and spacing."
      ],
      healers: [
        "Keep Toxic Mist targets alive and be ready for heavy ticking damage.",
        "Use cooldowns for Falling Ash impacts and bad overlaps with slime or storm damage.",
        "Heroic Iron Prison targets need attention before the delayed hit lands.",
        "Do not chase players through Ashen Wall or tornado paths unless necessary."
      ],
      dps: [
        "Cleave bosses only if it does not break positioning or spawn-control plans.",
        "Kill Foul Slimes quickly when they spawn from Foul Geyser.",
        "Stay clear of Ashen Wall lines and Toxic Storm tornadoes while maintaining damage.",
        "Do not tunnel boss damage during Falling Ash or slime waves."
      ],
      everyone: [
        "Move out of Foul Stream and do not stand in Toxic Storm tornado paths.",
        "Avoid Ashen Wall. It creates a dangerous line that should not be crossed casually.",
        "Watch the Falling Ash timer and be ready for raid damage when it lands.",
        "Keep the room tidy. Random movement can trap the raid between walls, storms, and slimes."
      ],
      heroic: [
        "Heroic adds Iron Prison and Iron Tomb, creating lethal delayed damage and extra obstacles from Iron Tomb placements.",
        "Iron Prison targets should use personals or receive externals before the debuff expires.",
        "Iron Tomb placement must not block the raid's movement path.",
        "Heroic ground clutter makes a pre-planned boss movement route important."
      ]
    },
    wipes: [
      "Foul Stream or Ashen Wall aimed through the raid.",
      "Foul Slimes reaching healers or spreading through the group.",
      "Falling Ash landing while players are already low.",
      "Heroic Iron Prison targets dying without cooldowns."
    ],
    reminder: "Aim streams and walls safely, kill slimes, dodge storms, respect Falling Ash, and use cooldowns for Heroic Iron Prison or heavy Toxic Mist overlaps."
  },
  {
    name: "General Nazgrim",
    slug: "general-nazgrim",
    phase: "Control adds and rage. Stop boss damage in Defensive Stance unless the raid leader calls for it.",
    sections: {
      tanks: [
        "Swap Nazgrim for Sundering Blow stacks.",
        "Move Nazgrim out of Ravager paths and keep him positioned away from active add control areas.",
        "Pick up Kor'kron Ironblades and other loose adds quickly.",
        "Do not feed rage with avoidable damage taken from Nazgrim abilities."
      ],
      healers: [
        "Heal Assassin targets quickly, especially if Backstab pressure overlaps with raid damage.",
        "Watch tanks during Sundering Blow stacks and add waves.",
        "Prepare raid healing for War Song and for mistakes during Ravager or Heroic Shockwave.",
        "Keep players stable while DPS swaps to banners, totems, and priority adds."
      ],
      dps: [
        "Stop attacking Nazgrim in Defensive Stance unless specifically assigned or called.",
        "Kill Kor'kron Banners, Healing Tide Totems, and priority adds immediately.",
        "Interrupt Kor'kron Arcweavers and stop Warshaman healing when possible.",
        "Focus Assassins before they kill fixated players."
      ],
      everyone: [
        "Move out of Ravager and Heroic Shockwave lines.",
        "Do not pad on the boss during Defensive Stance. Extra rage creates more dangerous abilities.",
        "Stack, spread, or kite according to the active add wave assignments.",
        "Use personal cooldowns if targeted by an Assassin or caught during add chaos."
      ],
      heroic: [
        "Heroic adds Kor'kron Snipers. Their target must avoid lining the shot through the raid.",
        "Add waves are more punishing, so interrupts and fast target swaps are mandatory.",
        "Rage control is stricter. Defensive Stance damage is a raid problem, not a parse window.",
        "Assign backups for banners, totems, Arcweaver interrupts, and Sniper handling."
      ]
    },
    wipes: [
      "Boss attacked during Defensive Stance, feeding rage.",
      "Banners, Healing Tide Totems, or Arcweavers left alive too long.",
      "Ravager or Heroic Shockwave hitting stacked players.",
      "Heroic Sniper lines aimed through the raid."
    ],
    reminder: "Swap Sundering Blow, stop boss damage in Defensive, kill banners and totems, interrupt Arcweavers, control Assassins, and dodge Ravager and Shockwave lines."
  },
  {
    name: "Malkorok",
    slug: "malkorok",
    phase: "Maintain Ancient Barrier shields, soak Imploding Energy, memorize Arcing Smash, then survive Blood Rage.",
    sections: {
      tanks: [
        "Swap for Fatal Strike stacks.",
        "During Blood Rage, execute the assigned solo-tank or shared-soak plan with major cooldowns.",
        "Keep Malkorok positioned consistently so the raid can track Arcing Smash locations.",
        "Avoid moving the boss in ways that hide Breath of Y'Shaarj danger zones."
      ],
      healers: [
        "Healing builds Ancient Barrier instead of restoring health while Ancient Miasma is active.",
        "Keep players' barriers strong before Imploding Energy and Breath of Y'Shaarj.",
        "Use cooldowns during Blood Rage and after failed soaks.",
        "Heroic: watch Displaced Energy targets and coordinate dispels away from the raid."
      ],
      dps: [
        "Soak assigned Imploding Energy swirls. Unsoaked swirls cause heavy raid damage.",
        "Keep damage up while preserving safe movement for Arcing Smash and Breath of Y'Shaarj.",
        "Avoid soaking orbs unless assigned, especially on Heroic where Orbs of Corruption remove barriers.",
        "Use cooldowns during safe burn windows, not while running through smash zones."
      ],
      everyone: [
        "Remember the three Arcing Smash locations. Breath of Y'Shaarj will fire through those areas afterward.",
        "Soak Imploding Energy if assigned and call missed swirls immediately.",
        "During Blood Rage, follow the raid's stack or spread plan exactly.",
        "Do not let your Ancient Barrier drop from avoidable orb or ground damage."
      ],
      heroic: [
        "Heroic adds Displaced Energy. Dispel it at assigned spots away from the raid.",
        "Orbs of Corruption persist and remove Ancient Barrier from players who touch them.",
        "Keep clear lanes because orbs, smash zones, and Breath paths can overlap.",
        "Blood Rage cooldown assignments should be locked before pull."
      ]
    },
    wipes: [
      "Imploding Energy swirls left unsoaked.",
      "Raid forgetting Arcing Smash locations and getting hit by Breath of Y'Shaarj.",
      "Ancient Barrier depleted by avoidable orb or ground damage.",
      "Blood Rage handled without the assigned cooldown plan."
    ],
    reminder: "Build shields, soak Imploding Energy, memorize Arcing Smash locations, dodge Breath lines, swap Fatal Strike, and execute the Blood Rage cooldown plan."
  },
  {
    name: "Spoils of Pandaria",
    slug: "spoils-of-pandaria",
    phase: "Open crates in a controlled order, kill enough enemies to charge the lever, then repeat on the other side.",
    sections: {
      tanks: [
        "Split tanks by side and pick up every crate enemy as it spawns.",
        "Open crates only at the assigned pace. Too many active enemies can overwhelm a side.",
        "Move dangerous mobs out of bad ground while keeping them grouped for cleave.",
        "Call when your side is safe to open a larger crate or needs time to recover."
      ],
      healers: [
        "Split healing evenly between rooms and call if your side is falling behind.",
        "Use cooldowns when large crates or several medium crates overlap.",
        "Dispel and heal through Mogu and Mantid debuffs quickly.",
        "Heroic: stabilize the raid after Unstable Sparks spawn and die."
      ],
      dps: [
        "Kill high-priority crate enemies before opening more crates.",
        "Use the Pandaren crate buffs effectively and keep them assigned to the right players.",
        "Swap to Unstable Sparks on Heroic before they explode.",
        "Do not chase meters by opening extra crates without the tank or raid leader call."
      ],
      everyone: [
        "Stay on your assigned side until the lever objective is complete.",
        "Avoid bombs, pools, frontal attacks, and other crate-specific ground effects.",
        "Click the lever only when your side has enough energy and the call is made.",
        "After the first room, move quickly to the opposite side and repeat the crate plan."
      ],
      heroic: [
        "Heroic adds Unstable Sparks as a recurring priority target.",
        "Sparks must die before Supernova or the raid takes heavy damage.",
        "Crate pacing is tighter. Opening extra crates during spark windows is dangerous.",
        "Assign reliable players to call spark spawns and target swaps."
      ]
    },
    wipes: [
      "Opening too many crates at once.",
      "Unstable Sparks reaching Supernova on Heroic.",
      "One room finishing much later than the other because crate pacing was uneven.",
      "Players standing in crate-specific bombs, pools, or frontal attacks."
    ],
    reminder: "Open crates on call, kill priority mobs, use Pandaren buffs, do not over-open, kill Heroic Sparks, and pull the lever only when the side is charged."
  },
  {
    name: "Thok the Bloodthirsty",
    slug: "thok-the-bloodthirsty",
    phase: "Stack and heal through Screeches, kite during Blood Frenzy, then release the correct prisoner for the next phase.",
    sections: {
      tanks: [
        "Swap for Fearsome Roar stacks and keep Thok faced away from the raid.",
        "During Blood Frenzy, help keep the boss moving safely while fixated players kite.",
        "Pick up the Jailer quickly and position it for a fast kill.",
        "Be ready for changed breath effects after each prisoner is released."
      ],
      healers: [
        "Plan healing cooldowns for accelerating Deafening Screech stacks.",
        "Do not rely on long casts late in the stack phase, because Deafening Screech interrupts spellcasting.",
        "Top the fixated player before and during Blood Frenzy kiting.",
        "Handle poison, freezing, or fire phase damage based on the prisoner released."
      ],
      dps: [
        "Burn Thok during stack phases while staying ready for the Blood Frenzy transition.",
        "Kill the Jailer quickly so the raid can open the assigned prisoner cage.",
        "Break players out of ice tombs during the frost phase.",
        "Do not stand in front of Thok or chase fixated players into his path."
      ],
      everyone: [
        "Stack for healing until the raid leader calls the spread or kite transition.",
        "If fixated during Blood Frenzy, kite Thok along the planned path and avoid cutting through the raid.",
        "Move away from Thok's front. His cone and melee are lethal to non-tanks.",
        "Use personals during high Screech stacks or when kiting as the fixate target."
      ],
      heroic: [
        "Heroic adds extra prisoner-related threats, including bats and a yeti during later phases.",
        "Kill Captive Cave Bats quickly when they appear.",
        "Avoid the Starved Yeti's path and be ready for extra raid damage.",
        "If a prisoner dies, Thok heals, so protect released prisoners and keep the phase plan clean."
      ]
    },
    wipes: [
      "Trying to cast through late Deafening Screeches.",
      "Fixated player kiting Thok through the raid.",
      "Jailer dying late and delaying the next prisoner release.",
      "Ice tombs, bats, or yeti mechanics ignored on later phases."
    ],
    reminder: "Stack for Screeches, swap Fearsome Roar, kite Blood Frenzy on the planned route, kill the Jailer, release the assigned prisoner, and break ice tombs fast."
  },
  {
    name: "Siegecrafter Blackfuse",
    slug: "siegecrafter-blackfuse",
    phase: "Kill priority conveyor weapons, control Shredders, and keep the platform clear of mines, lasers, missiles, and sawblades.",
    sections: {
      tanks: [
        "Swap Blackfuse for Electrostatic Charge stacks.",
        "Tank Automated Shredders away from the raid and kill them after Electrostatic Charge has amplified your damage.",
        "Keep Shredders out of Automatic Repair Beam so they do not heal.",
        "Use cooldowns for Shredder overloads and high Electrostatic Charge stacks."
      ],
      healers: [
        "Prepare for raid damage from missiles, mines, Overload, and Shredder mistakes.",
        "Keep belt players healthy before and after conveyor assignments.",
        "Watch tanks during Electrostatic Charge and Shredder windows.",
        "Use cooldowns when multiple platform hazards overlap."
      ],
      dps: [
        "Assigned belt teams must kill the chosen weapon before it reaches the end of the conveyor.",
        "On the platform, kill Crawler Mines before they reach players.",
        "Swap to Automated Shredders when called, especially after tank damage amplification is ready.",
        "Do not tunnel Blackfuse while mines, missiles, or Shredders are active."
      ],
      everyone: [
        "Dodge sawblades, missiles, laser trails, and magnet movement.",
        "Stay clear of Crawler Mines unless assigned to control them.",
        "Respect conveyor belt assignments. Missed belt kills change the entire platform pattern.",
        "Keep the middle of the platform readable so tanks and mine control have room."
      ],
      heroic: [
        "Heroic overcharges weapons, making the missed or selected weapon more dangerous on the platform.",
        "Overcharged mines, lasers, missiles, magnets, and sawblades require faster target swaps and cleaner movement.",
        "Belt priority must be planned in advance. Improvising weapon kills causes lethal overlaps.",
        "Every player needs to know the current overcharged hazard before it reaches the platform."
      ]
    },
    wipes: [
      "Conveyor weapon not killed in time.",
      "Crawler Mines reaching the raid.",
      "Shredders healed by Automatic Repair Beam or left alive too long.",
      "Players boxed in by sawblades, lasers, missiles, and magnet movement."
    ],
    reminder: "Swap Electrostatic Charge, kill belt weapons on assignment, control Shredders and mines, avoid sawblades and lasers, and call every Heroic overcharged weapon."
  },
  {
    name: "Paragons of the Klaxxi",
    slug: "paragons-of-the-klaxxi",
    phase: "Only three Paragons are active at once. Follow the kill order and handle each active set's named mechanics.",
    sections: {
      tanks: [
        "Pick up newly active Paragons immediately when one dies.",
        "Keep melee Paragons controlled and positioned so cleaves and fixates do not cross the raid.",
        "Use cooldowns for heavy tank combinations, especially when Korven or Kil'ruk is active.",
        "Communicate when a Paragon dies so the next tank pickup is instant."
      ],
      healers: [
        "Track the active Paragon set. Incoming damage changes every time a boss dies.",
        "Use cooldowns for Aim, Fiery Edge, toxin combinations, parasite mistakes, and late-fight overlaps.",
        "Keep Mesmerize and Hungry Kunchong targets alive while DPS frees them.",
        "Do not over-dispel or cleanse effects that the strategy assigns to specific players."
      ],
      dps: [
        "Follow the assigned kill order exactly. Killing the wrong Paragon can create a much harder active set.",
        "Swap to Hungry Kunchong, Amber, Bloods, parasites, and other priority targets immediately.",
        "Break Mesmerize by damaging the Hungry Kunchong before it reaches its target.",
        "Use corpse-granted abilities only if assigned. Wrong use can waste major progression tools."
      ],
      everyone: [
        "React to the active Paragons, not a fixed single-boss script.",
        "Handle Aim with the assigned soak or line plan.",
        "Move out of Amber, Fiery Edge lines, toxin effects, and other active ground mechanics.",
        "Call Mesmerize, parasite, and fixate targets clearly."
      ],
      heroic: [
        "Heroic changes several Paragon mechanics and makes the kill order stricter.",
        "Korven's Encase in Amber cannot be treated as a casual cleave target. Plan how to handle it before pull.",
        "Rik'kal's Amber Scorpion assignment must handle Amber Parasites correctly during the transform window.",
        "Hisek's Heroic mechanics add movement pressure. Keep Aim and Rapid Fire style assignments clear."
      ]
    },
    wipes: [
      "Wrong Paragon killed, creating an unplanned active combination.",
      "Mesmerize target reaching a Hungry Kunchong.",
      "Aim, Fiery Edge, toxins, or Amber mechanics handled without assignments.",
      "Corpse abilities unused, used by the wrong player, or used at the wrong time."
    ],
    reminder: "Follow the kill order, pick up new Paragons instantly, swap to priority targets, break Mesmerize, handle Aim and toxins, and use corpse abilities only as assigned."
  },
  {
    name: "Garrosh Hellscream",
    slug: "garrosh-hellscream",
    phase: "Control phase-one adds, execute transition realms, interrupt mind controls, and survive empowered mechanics.",
    sections: {
      tanks: [
        "Swap Garrosh for Gripping Despair stacks and use cooldowns for high stacks or Empowered Gripping Despair.",
        "In phase one, control Warbringers and keep them positioned for Iron Star use if that is the strategy.",
        "Pick up transition and phase adds immediately so they do not hit healers.",
        "During Empowered Whirling Corruption, keep spawned adds separated so they do not heal each other on death."
      ],
      healers: [
        "Prepare cooldowns for Whirling Corruption, Empowered Whirling Corruption, and transition Annihilate casts.",
        "Stabilize players targeted by Desecrated Weapon movement and Mind Control breaks.",
        "Keep tanks alive through Gripping Despair and add pickup moments.",
        "In Heroic phase four, be ready for Malice and Bombardment damage patterns."
      ],
      dps: [
        "Kill or control phase-one adds according to the Iron Star plan.",
        "Interrupt Farseer Wolf Rider Chain Heal in phase one.",
        "Kill Desecrated Weapons or move away from them according to the phase strategy.",
        "Interrupt and break Touch of Y'Shaarj mind controls immediately."
      ],
      everyone: [
        "Move for Desecrated Weapon and do not drop it in the raid's planned path.",
        "During transition realms, kill adds quickly and use the protective buff before Annihilate.",
        "Spread for Empowered Whirling Corruption and do not cleave the spawned adds together.",
        "Save personals for Whirling, Annihilate, Malice, or other assigned danger points."
      ],
      heroic: [
        "Heroic adds a final phase after Garrosh reaches low health.",
        "Handle Malice with the assigned soak order and do not let it expire without enough players soaking.",
        "Avoid Bombardment zones and be ready for the summoned Iron Star pattern in the final phase.",
        "Manifest Rage adds must be controlled while the raid continues handling Malice and movement."
      ]
    },
    wipes: [
      "Farseer Chain Heal casts going through in phase one.",
      "Mind controls not interrupted and broken quickly.",
      "Empowered Whirling adds dying together and healing each other.",
      "Heroic Malice soak order missed in the final phase."
    ],
    reminder: "Control phase-one adds, interrupt Chain Heal, handle Desecrated Weapons, break mind controls, spread for Empowered Whirling, separate adds, and follow Heroic Malice soaks."
  }
];
