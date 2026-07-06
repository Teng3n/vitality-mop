import wclBossAttendanceSummary from "../data/wclBossAttendanceSummary.json";
import { SIEGE_OF_ORGRIMMAR_RELEASE_DATE } from "./attendanceTiers";
import { activeRosterPlayers, getCanonicalPlayerSlug, raidNights } from "./guildData";
import { normalizeProgressionName } from "./progressionTiers";

export interface WclBossAttendanceSummaryPlayer {
  playerSlug: string;
  playerName: string;
  appearances: number;
  latestDate: string | null;
  latestReportUrl: string | null;
}

export interface WclBossAttendanceSummaryBoss {
  bossKey: string;
  bossName: string;
  eventCount: number;
  players: WclBossAttendanceSummaryPlayer[];
}

export interface WclBossAttendanceSummaryFirstLog {
  playerSlug: string;
  date: string;
  startTime?: string | null;
}

export interface WclBossAttendanceSummaryKillEvent {
  bossKey: string;
  date: string;
  startTime?: string | null;
  reportCode: string;
  fightId: number;
  playerSlugs: string[];
}

export interface WclBossAttendanceSummaryData {
  generatedAt: string | null;
  source: string;
  scope: string;
  tierSlug: "tier-16";
  eventCount: number;
  bossCount: number;
  playerCount: number;
  firstLoggedRaidDates?: WclBossAttendanceSummaryFirstLog[];
  heroicKillEvents?: WclBossAttendanceSummaryKillEvent[];
  bosses: WclBossAttendanceSummaryBoss[];
}

export interface PlayerBossAttendanceSummary {
  playerSlug: string;
  bossName: string;
  appearances: number;
  latestDate: string | null;
  latestReportUrl: string | null;
}

export interface BossAttendanceOverview {
  generatedAt: string | null;
  tierSlug: string;
  eventCount: number;
  bossCount: number;
  playerCount: number;
}

export interface PlayerBossAttendanceStats {
  playerSlug: string;
  availableBossKillCount: number;
  attendedBossKillCount: number;
  bossBenchCount: number;
  availableRaidNightCount: number;
  syncedRaidNightCount: number;
}

export interface PlayerRosterStart {
  date: string;
  label: string;
  source: "tierStart" | "explicit" | "firstLog" | "pendingFirstLog";
}

const attendanceSummary = wclBossAttendanceSummary as WclBossAttendanceSummaryData;
const raidTimeZone = "America/Los_Angeles";
const pendingFirstLogRosterStartDate = "9999-12-31";

const normalizeBossKey = (bossName: string) => normalizeProgressionName(bossName);
const activeRosterBySlug = new Map(activeRosterPlayers.map((player) => [player.slug, player]));
const raidNightByDate = new Map(raidNights.map((night) => [night.isoDate, night]));
const getPacificIsoDate = (isoDateTime: string) => {
  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: raidTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};
const getSummaryEventRaidDate = (event: { date: string; startTime?: string | null }) =>
  getPacificIsoDate(event.startTime ?? "") || event.date;

const firstLoggedRaidDateBySlug = (() => {
  const dateBySlug = new Map<string, string>();

  for (const event of attendanceSummary.firstLoggedRaidDates ?? []) {
    const canonicalPlayerSlug = getCanonicalPlayerSlug(event.playerSlug);

    if (!activeRosterBySlug.has(canonicalPlayerSlug)) {
      continue;
    }

    const raidDate = getSummaryEventRaidDate(event);

    if (!raidNightByDate.has(raidDate)) {
      continue;
    }

    const currentDate = dateBySlug.get(canonicalPlayerSlug);

    if (!currentDate || raidDate < currentDate) {
      dateBySlug.set(canonicalPlayerSlug, raidDate);
    }
  }

  return dateBySlug;
})();

export const getPlayerRosterStart = (playerSlug: string): PlayerRosterStart => {
  const player = activeRosterBySlug.get(playerSlug);

  if (player?.rosterStartSource === "firstLog") {
    const firstLoggedDate = firstLoggedRaidDateBySlug.get(playerSlug);

    return firstLoggedDate
      ? { date: firstLoggedDate, label: firstLoggedDate, source: "firstLog" }
      : { date: pendingFirstLogRosterStartDate, label: "No synced log yet", source: "pendingFirstLog" };
  }

  if (player?.rosterStartDate) {
    return { date: player.rosterStartDate, label: player.rosterStartDate, source: "explicit" };
  }

  return { date: SIEGE_OF_ORGRIMMAR_RELEASE_DATE, label: "Pre-SoO", source: "tierStart" };
};

const getBossSummary = (bossName: string) => {
  const bossKey = normalizeBossKey(bossName);
  return attendanceSummary.bosses.find((boss) => boss.bossKey === bossKey);
};

const bossAttendanceStatsBySlug = (() => {
  const statsBySlug = new Map<string, PlayerBossAttendanceStats>(
    activeRosterPlayers.map((player) => [
      player.slug,
      {
        playerSlug: player.slug,
        availableBossKillCount: 0,
        attendedBossKillCount: 0,
        bossBenchCount: 0,
        availableRaidNightCount: 0,
        syncedRaidNightCount: 0,
      },
    ]),
  );
  const syncedRaidDates = new Set<string>();
  const availableRaidDatesBySlug = new Map(activeRosterPlayers.map((player) => [player.slug, new Set<string>()]));

  for (const killEvent of attendanceSummary.heroicKillEvents ?? []) {
    const killDate = getSummaryEventRaidDate(killEvent);
    const raidNight = raidNightByDate.get(killDate);

    if (!raidNight) {
      continue;
    }

    syncedRaidDates.add(killDate);
    const presentSlugs = new Set(
      killEvent.playerSlugs.map(getCanonicalPlayerSlug).filter((playerSlug) => activeRosterBySlug.has(playerSlug)),
    );
    const unavailableSlugs = new Set([...raidNight.out, ...raidNight.late, ...raidNight.mia].map((player) => player.slug));

    for (const player of activeRosterPlayers) {
      if (killDate < getPlayerRosterStart(player.slug).date) {
        continue;
      }

      if (unavailableSlugs.has(player.slug)) {
        continue;
      }

      const stats = statsBySlug.get(player.slug);

      if (!stats) {
        continue;
      }

      availableRaidDatesBySlug.get(player.slug)?.add(killDate);
      stats.availableBossKillCount += 1;

      if (presentSlugs.has(player.slug)) {
        stats.attendedBossKillCount += 1;
      } else {
        stats.bossBenchCount += 1;
      }
    }
  }

  for (const stats of statsBySlug.values()) {
    stats.syncedRaidNightCount = syncedRaidDates.size;
    stats.availableRaidNightCount = availableRaidDatesBySlug.get(stats.playerSlug)?.size ?? 0;
  }

  return statsBySlug;
})();

export const getPlayerBossAttendanceStats = (playerSlug: string): PlayerBossAttendanceStats =>
  bossAttendanceStatsBySlug.get(playerSlug) ?? {
    playerSlug,
    availableBossKillCount: 0,
    attendedBossKillCount: 0,
    bossBenchCount: 0,
    availableRaidNightCount: 0,
    syncedRaidNightCount: 0,
  };

export const getPlayerBossBenchCount = (playerSlug: string) => getPlayerBossAttendanceStats(playerSlug).bossBenchCount;

export const getMaxPlayerBossBenchCount = () =>
  Math.max(0, ...[...bossAttendanceStatsBySlug.values()].map((stats) => stats.bossBenchCount));

export const getPlayerBossAttendanceSummary = (
  playerSlug: string,
  bossName: string,
): PlayerBossAttendanceSummary => {
  const boss = getBossSummary(bossName);
  const player = boss?.players.find((bossPlayer) => bossPlayer.playerSlug === playerSlug);

  return {
    playerSlug,
    bossName,
    appearances: player?.appearances ?? 0,
    latestDate: player?.latestDate ?? null,
    latestReportUrl: player?.latestReportUrl ?? null,
  };
};

export const hasCurrentBossAttendanceData = () => attendanceSummary.eventCount > 0;

export const hasBossAttendanceData = (bossName: string) => Boolean(getBossSummary(bossName)?.eventCount);

export const getBossAttendanceOverview = (): BossAttendanceOverview => ({
  generatedAt: attendanceSummary.generatedAt,
  tierSlug: attendanceSummary.tierSlug,
  eventCount: attendanceSummary.eventCount,
  bossCount: attendanceSummary.bossCount,
  playerCount: attendanceSummary.playerCount,
});

export const getBossAttendanceStatusText = () => {
  const overview = getBossAttendanceOverview();

  if (overview.eventCount === 0) {
    return "No synced SoO boss attendance events yet; boss bench suggestions are not using Warcraft Logs attendance.";
  }

  return `Using ${overview.eventCount} synced SoO boss attendance event${overview.eventCount === 1 ? "" : "s"} across ${
    overview.bossCount
  } boss${overview.bossCount === 1 ? "" : "es"} and ${overview.playerCount} player${
    overview.playerCount === 1 ? "" : "s"
  }${overview.generatedAt ? `, synced ${overview.generatedAt.slice(0, 10)}` : ""}.`;
};
