import type { RaidNight } from "./guildData";

export interface AttendanceTier {
  slug: string;
  label: string;
  shortLabel: string;
  startsOn: string;
}

export const SIEGE_OF_ORGRIMMAR_RELEASE_DATE = "2026-06-04";
export const currentAttendanceTierSlug = "siege-of-orgrimmar";

export const attendanceTiers: AttendanceTier[] = [
  {
    slug: "siege-of-orgrimmar",
    label: "Siege of Orgrimmar",
    shortLabel: "SoO",
    startsOn: SIEGE_OF_ORGRIMMAR_RELEASE_DATE,
  },
  {
    slug: "throne-of-thunder",
    label: "Throne of Thunder",
    shortLabel: "ToT",
    startsOn: "2025-01-01",
  },
];

export const getCurrentAttendanceTier = () =>
  attendanceTiers.find((tier) => tier.slug === currentAttendanceTierSlug) ?? attendanceTiers[0];

export const getAttendanceTierBySlug = (slug = currentAttendanceTierSlug) =>
  attendanceTiers.find((tier) => tier.slug === slug) ?? getCurrentAttendanceTier();

export const getAttendanceTierForDate = (isoDate: string) =>
  isoDate >= SIEGE_OF_ORGRIMMAR_RELEASE_DATE
    ? getAttendanceTierBySlug("siege-of-orgrimmar")
    : getAttendanceTierBySlug("throne-of-thunder");

export const isAttendanceDateInTier = (isoDate: string, tierSlug = currentAttendanceTierSlug) =>
  getAttendanceTierForDate(isoDate).slug === tierSlug;

export const isCurrentAttendanceDate = (isoDate: string) => isAttendanceDateInTier(isoDate, currentAttendanceTierSlug);

export const getRaidNightsForAttendanceTier = <T extends Pick<RaidNight, "isoDate">>(
  nights: T[],
  tierSlug = currentAttendanceTierSlug,
) => nights.filter((night) => isAttendanceDateInTier(night.isoDate, tierSlug));
