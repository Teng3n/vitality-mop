const nameReplacements: Record<string, string> = {
  "Ã©": "é",
  "Ã³": "ó",
  "Ã«": "ë",
};

export const cleanPlayerName = (name: string) =>
  Object.entries(nameReplacements).reduce(
    (value, [search, replacement]) => value.replaceAll(search, replacement),
    name.trim(),
  );

export const normalizePlayerName = (name: string) =>
  cleanPlayerName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

export const getPlayerSlug = (name: string) =>
  normalizePlayerName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getPlayerProfileHref = (name: string) => `/player/${getPlayerSlug(name)}`;
