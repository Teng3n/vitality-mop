import roster from "../data/roster.json";

export const classColors: Record<string, string> = {
  "Death Knight": "#c41e3a",
  Druid: "#ff7c0a",
  Hunter: "#aad372",
  Mage: "#3fc7eb",
  Monk: "#00ff98",
  Paladin: "#f48cba",
  Priest: "#ffffff",
  Rogue: "#fff468",
  Shaman: "#0070dd",
  Warlock: "#8788ee",
  Warrior: "#c69b6d",
};

const normalizeName = (name: string) => name.trim().toLocaleLowerCase();

const rosterByName = new Map(roster.map((member) => [normalizeName(member.character), member]));

export const getPlayerClass = (name: string) => rosterByName.get(normalizeName(name))?.class;

export const getPlayerClassColor = (name: string) => {
  const className = getPlayerClass(name);
  return className ? classColors[className] : undefined;
};

export const getPlayerNameStyle = (name: string) => {
  const color = getPlayerClassColor(name);
  return color ? `--player-color: ${color}` : undefined;
};
