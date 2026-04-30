export const GUILD_REGION = "us";

const knownRealmSlugs: Record<string, string> = {
  leishen: "raden",
  pagle: "pagle",
  raden: "raden",
};

const cleanText = (value: string) => value.trim();

export const getWarcraftLogsSearchUrl = (characterName: string) =>
  `https://classic.warcraftlogs.com/search/?term=${encodeURIComponent(cleanText(characterName))}`;

export const getWarcraftLogsRealmSlug = (realm: string) => {
  const trimmed = cleanText(realm);
  const normalizedKey = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (knownRealmSlugs[normalizedKey]) {
    return knownRealmSlugs[normalizedKey];
  }

  return normalizedKey;
};

export const getWarcraftLogsCharacterUrl = (characterName: string, realm?: string, region = GUILD_REGION) => {
  const character = cleanText(characterName).toLocaleLowerCase();
  const realmSlug = realm ? getWarcraftLogsRealmSlug(realm) : "";

  if (!character || !realmSlug) {
    return getWarcraftLogsSearchUrl(character);
  }

  return `https://classic.warcraftlogs.com/character/${encodeURIComponent(region.toLocaleLowerCase())}/${encodeURIComponent(realmSlug)}/${encodeURIComponent(character)}`;
};
