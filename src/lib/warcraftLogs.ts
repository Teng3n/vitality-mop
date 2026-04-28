export const GUILD_REGION = "us";

const knownRealmSlugs: Record<string, string> = {
  leishen: "lei-shen",
  raden: "ra-den",
};

const cleanText = (value: string) => value.trim();

export const getWarcraftLogsSearchUrl = (characterName: string) =>
  `https://www.warcraftlogs.com/search/?term=${encodeURIComponent(cleanText(characterName))}`;

export const getWarcraftLogsRealmSlug = (realm: string) => {
  const trimmed = cleanText(realm);
  const normalizedKey = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (knownRealmSlugs[normalizedKey]) {
    return knownRealmSlugs[normalizedKey];
  }

  return trimmed
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const getWarcraftLogsCharacterUrl = (characterName: string, realm?: string, region = GUILD_REGION) => {
  const character = cleanText(characterName);
  const realmSlug = realm ? getWarcraftLogsRealmSlug(realm) : "";

  if (!character || !realmSlug) {
    return getWarcraftLogsSearchUrl(character);
  }

  return `https://www.warcraftlogs.com/character/${encodeURIComponent(region)}/${encodeURIComponent(realmSlug)}/${encodeURIComponent(character)}`;
};
