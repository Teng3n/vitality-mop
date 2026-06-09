import wclBossAttendance from "../data/wclBossAttendance.json";
import { normalizeProgressionName } from "./progressionTiers";

export interface WclBossAttendanceEvent {
  playerSlug: string;
  playerName: string;
  playerClass: string | null;
  playerServer: string | null;
  attendanceTierSlug: "throne-of-thunder" | "siege-of-orgrimmar";
  expansionSlug: string;
  tierSlug: string;
  raidName: string;
  bossKey: string;
  bossName: string;
  encounterId: number | null;
  difficulty: string;
  difficultyId: number | null;
  rawDifficultyId: number | string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reportCode: string;
  reportTitle: string;
  reportUrl: string;
  fightId: number;
  kill: boolean;
  sourceGuildId?: number;
  sourceGuildName: string;
  sourceServerSlug: string;
  sourceRegion: string;
  sourceLabel: string;
}

export interface WclBossAttendanceData {
  generatedAt: string | null;
  source: string;
  scope: string;
  toolScopeTierSlug: "tier-16";
  historicalTierSlugs: string[];
  events: WclBossAttendanceEvent[];
}

export interface PlayerBossAttendanceSummary {
  playerSlug: string;
  bossName: string;
  appearances: number;
  latestDate: string | null;
  latestReportUrl: string | null;
  events: WclBossAttendanceEvent[];
}

export interface BossAttendanceOverview {
  generatedAt: string | null;
  tierSlug: string;
  eventCount: number;
  bossCount: number;
  playerCount: number;
}

const attendanceData = wclBossAttendance as WclBossAttendanceData;

const normalizeBossKey = (bossName: string) => normalizeProgressionName(bossName);

const getAppearanceKey = (event: WclBossAttendanceEvent) =>
  `${event.playerSlug}:${event.tierSlug}:${event.bossKey}:${event.date}:${event.reportCode}`;

export const getBossAttendanceEvents = (tierSlug = attendanceData.toolScopeTierSlug) =>
  (attendanceData.events ?? [])
    .filter((event) => event.tierSlug === tierSlug)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.reportCode.localeCompare(a.reportCode) ||
        a.bossName.localeCompare(b.bossName, undefined, { sensitivity: "base" }) ||
        a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" }),
    );

export const getPlayerBossAttendanceSummary = (
  playerSlug: string,
  bossName: string,
  tierSlug = attendanceData.toolScopeTierSlug,
): PlayerBossAttendanceSummary => {
  const bossKey = normalizeBossKey(bossName);
  const matchingEvents = getBossAttendanceEvents(tierSlug).filter(
    (event) => event.playerSlug === playerSlug && event.bossKey === bossKey,
  );
  const appearanceEventsByKey = new Map<string, WclBossAttendanceEvent>();

  for (const event of matchingEvents) {
    const key = getAppearanceKey(event);
    const previous = appearanceEventsByKey.get(key);

    if (!previous || (event.endTime ?? event.startTime ?? "") > (previous.endTime ?? previous.startTime ?? "")) {
      appearanceEventsByKey.set(key, event);
    }
  }

  const appearanceEvents = [...appearanceEventsByKey.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.reportCode.localeCompare(a.reportCode),
  );
  const latestEvent = appearanceEvents[0] ?? null;

  return {
    playerSlug,
    bossName,
    appearances: appearanceEvents.length,
    latestDate: latestEvent?.date ?? null,
    latestReportUrl: latestEvent?.reportUrl ?? null,
    events: matchingEvents,
  };
};

export const hasCurrentBossAttendanceData = () => getBossAttendanceEvents(attendanceData.toolScopeTierSlug).length > 0;

export const hasBossAttendanceData = (bossName: string, tierSlug = attendanceData.toolScopeTierSlug) => {
  const bossKey = normalizeBossKey(bossName);
  return getBossAttendanceEvents(tierSlug).some((event) => event.bossKey === bossKey);
};

export const getBossAttendanceOverview = (tierSlug = attendanceData.toolScopeTierSlug): BossAttendanceOverview => {
  const events = getBossAttendanceEvents(tierSlug);

  return {
    generatedAt: attendanceData.generatedAt,
    tierSlug,
    eventCount: events.length,
    bossCount: new Set(events.map((event) => event.bossKey)).size,
    playerCount: new Set(events.map((event) => event.playerSlug)).size,
  };
};

export const getBossAttendanceStatusText = (tierSlug = attendanceData.toolScopeTierSlug) => {
  const overview = getBossAttendanceOverview(tierSlug);

  if (overview.eventCount === 0) {
    return "No synced SoO boss attendance events yet; boss bench suggestions are not using Warcraft Logs attendance.";
  }

  return `Using ${overview.eventCount} synced SoO boss attendance event${overview.eventCount === 1 ? "" : "s"} across ${
    overview.bossCount
  } boss${overview.bossCount === 1 ? "" : "es"} and ${overview.playerCount} player${
    overview.playerCount === 1 ? "" : "s"
  }${overview.generatedAt ? `, synced ${overview.generatedAt.slice(0, 10)}` : ""}.`;
};
