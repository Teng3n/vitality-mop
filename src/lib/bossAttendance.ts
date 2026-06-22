import wclBossAttendanceSummary from "../data/wclBossAttendanceSummary.json";
import wclBossAttendance from "../data/wclBossAttendance.json";
import { activeRosterPlayers, raidNights } from "./guildData";
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

export interface WclBossAttendanceSummaryData {
  generatedAt: string | null;
  source: string;
  scope: string;
  tierSlug: "tier-16";
  eventCount: number;
  bossCount: number;
  playerCount: number;
  bosses: WclBossAttendanceSummaryBoss[];
}

interface WclBossAttendanceEvent {
  playerSlug: string;
  tierSlug: string;
  bossKey: string;
  bossName: string;
  date: string;
  reportCode: string;
  fightId: number;
  kill: boolean;
}

interface WclBossAttendanceData {
  events: WclBossAttendanceEvent[];
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

const attendanceSummary = wclBossAttendanceSummary as WclBossAttendanceSummaryData;
const attendanceData = wclBossAttendance as WclBossAttendanceData;

const normalizeBossKey = (bossName: string) => normalizeProgressionName(bossName);
const activeRosterSlugs = new Set(activeRosterPlayers.map((player) => player.slug));
const raidNightByDate = new Map(raidNights.map((night) => [night.isoDate, night]));
const getBossKillKey = (event: WclBossAttendanceEvent) =>
  `${event.tierSlug}:${event.bossKey}:${event.date}:${event.reportCode}:${event.fightId}`;

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
  const killEventsByKey = new Map<string, { date: string; presentSlugs: Set<string> }>();

  for (const event of attendanceData.events) {
    if (event.tierSlug !== attendanceSummary.tierSlug || !event.kill || !activeRosterSlugs.has(event.playerSlug)) {
      continue;
    }

    const key = getBossKillKey(event);
    const killEvent = killEventsByKey.get(key) ?? { date: event.date, presentSlugs: new Set<string>() };
    killEvent.presentSlugs.add(event.playerSlug);
    killEventsByKey.set(key, killEvent);
  }

  const syncedRaidDates = new Set<string>();
  const availableRaidDatesBySlug = new Map(activeRosterPlayers.map((player) => [player.slug, new Set<string>()]));

  for (const killEvent of killEventsByKey.values()) {
    const raidNight = raidNightByDate.get(killEvent.date);

    if (!raidNight) {
      continue;
    }

    syncedRaidDates.add(killEvent.date);
    const unavailableSlugs = new Set([...raidNight.out, ...raidNight.late, ...raidNight.mia].map((player) => player.slug));

    for (const player of activeRosterPlayers) {
      if (unavailableSlugs.has(player.slug)) {
        continue;
      }

      const stats = statsBySlug.get(player.slug);

      if (!stats) {
        continue;
      }

      availableRaidDatesBySlug.get(player.slug)?.add(killEvent.date);
      stats.availableBossKillCount += 1;

      if (killEvent.presentSlugs.has(player.slug)) {
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
