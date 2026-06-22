import { hasOfficerPasswordConfig, hasValidOfficerSession, jsonResponse, type OfficerAuthEnv } from "../_shared/officer-auth";
import { isCurrentAttendanceDate } from "../../src/lib/attendanceTiers";
import { getPlayerBossAttendanceStats } from "../../src/lib/bossAttendance";
import { activeRosterPlayers, raidNights } from "../../src/lib/guildData";
import { classColors } from "../../src/lib/playerStyles";

interface PagesContext {
  request: Request;
  env: OfficerAuthEnv;
}

type StatusKey = "out" | "late" | "mia";

interface OfficerRosterApiRow {
  player: string;
  href: string;
  class: string;
  classColor: string;
  spec: string;
  role: string;
  bench: number;
  bossesIn: number;
  availableBosses: number;
  availableRaidNights: number;
  syncedRaidNights: number;
  out: number;
  late: number;
  mia: number;
}

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405, { Allow: "GET" });
  }

  if (!hasOfficerPasswordConfig(env)) {
    console.error("[officer-roster] No officer password or password hash is configured.");
    return jsonResponse({ ok: false, message: "Unable to load officer roster." }, 500);
  }

  if (!(await hasValidOfficerSession(request, env))) {
    return jsonResponse({ ok: false, message: "Officer access required." }, 401);
  }

  const countBySlug = new Map(
    activeRosterPlayers.map((player) => {
      const bossStats = getPlayerBossAttendanceStats(player.slug);
      const row: OfficerRosterApiRow = {
        player: player.name,
        href: player.href,
        class: player.className,
        classColor: classColors[player.className] ?? "",
        spec: player.spec,
        role: player.role,
        bench: bossStats.bossBenchCount,
        bossesIn: bossStats.attendedBossKillCount,
        availableBosses: bossStats.availableBossKillCount,
        availableRaidNights: bossStats.availableRaidNightCount,
        syncedRaidNights: bossStats.syncedRaidNightCount,
        out: 0,
        late: 0,
        mia: 0,
      };

      return [player.slug, row];
    }),
  );

  const incrementCount = (playerSlug: string, key: StatusKey) => {
    const row = countBySlug.get(playerSlug);

    if (row) {
      row[key] += 1;
    }
  };

  for (const night of raidNights.filter((raidNight) => isCurrentAttendanceDate(raidNight.isoDate))) {
    for (const player of night.out) {
      incrementCount(player.slug, "out");
    }

    for (const player of night.late) {
      incrementCount(player.slug, "late");
    }

    for (const player of night.mia) {
      incrementCount(player.slug, "mia");
    }
  }

  const rows = [...countBySlug.values()].sort((a, b) => a.player.localeCompare(b.player, undefined, { sensitivity: "base" }));
  const totals = rows.reduce(
    (summary, row) => ({
      roster: summary.roster,
      bench: summary.bench + row.bench,
      bossesIn: summary.bossesIn + row.bossesIn,
      availableBosses: summary.availableBosses + row.availableBosses,
      out: summary.out + row.out,
      late: summary.late + row.late,
      mia: summary.mia + row.mia,
    }),
    { roster: rows.length, bench: 0, bossesIn: 0, availableBosses: 0, out: 0, late: 0, mia: 0 },
  );

  return jsonResponse({ ok: true, totals, rows });
};
