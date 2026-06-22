import mainSwaps from "../data/mainSwaps.json";
import { cleanPlayerName, normalizePlayerName } from "./playerNames";

interface MainSwapRow {
  current: string;
  aliases: string[];
}

const mainSwapRows = mainSwaps as MainSwapRow[];

export const getMainSwapAliases = (name: string) => {
  const normalized = normalizePlayerName(name);

  for (const swap of mainSwapRows) {
    const current = cleanPlayerName(swap.current);
    const aliases = swap.aliases.map(cleanPlayerName);
    const normalizedAliases = aliases.map(normalizePlayerName);

    if (normalizePlayerName(current) === normalized) {
      return aliases;
    }

    if (normalizedAliases.includes(normalized)) {
      return [current, ...aliases.filter((alias) => normalizePlayerName(alias) !== normalized)];
    }
  }

  return [];
};

export const getPlayerIdentityNames = (name: string) => {
  const cleaned = cleanPlayerName(name);
  return [cleaned, ...getMainSwapAliases(cleaned)];
};

export const isPlayerIdentityMatch = (playerName: string, candidateName: string) => {
  const candidate = normalizePlayerName(candidateName);
  return getPlayerIdentityNames(playerName).some((name) => normalizePlayerName(name) === candidate);
};
