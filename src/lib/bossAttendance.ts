import wclBossAttendanceSummary from "../data/wclBossAttendanceSummary.json";
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

const attendanceSummary = wclBossAttendanceSummary as WclBossAttendanceSummaryData;

const normalizeBossKey = (bossName: string) => normalizeProgressionName(bossName);

const getBossSummary = (bossName: string) => {
  const bossKey = normalizeBossKey(bossName);
  return attendanceSummary.bosses.find((boss) => boss.bossKey === bossKey);
};

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
