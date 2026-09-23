import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CharacterRecord = {
  name: string;
  appearances?: Array<{
    expansion: string;
    className: string;
    lastDate: string;
    reportCode: string;
    reportTitle: string;
    fightId: number;
    encounterName: string;
    reportUrl: string;
  }>;
};

type Actor = {
  id?: number | null;
  gameID?: number | null;
  name?: string | null;
  type?: string | null;
  subType?: string | null;
  petOwner?: number | null;
  server?: string | null;
  icon?: string | null;
};

type FightUnit = { id?: number | null; gameID?: number | null; petOwner?: number | null };

type ReportAudit = {
  masterData?: { actors?: Actor[] | null } | null;
  fights?: Array<{
    id?: number | null;
    name?: string | null;
    friendlyPlayers?: number[] | null;
    friendlyPets?: FightUnit[] | null;
    friendlyNPCs?: FightUnit[] | null;
  }> | null;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const charactersPath = path.join(root, "src", "data", "historicalRaiderCharacters.json");
const outputPath = path.join(root, "docs", "unknown-raider-audit.json");
const tokenEndpoint = "https://www.warcraftlogs.com/oauth/token";
const apiEndpoint = "https://classic.warcraftlogs.com/api/v2/client";

const clean = (value: unknown) => String(value ?? "").trim();
const nameKey = (value: unknown) => clean(value).normalize("NFC").toLocaleLowerCase();

async function accessToken() {
  const clientId = clean(process.env.WCL_CLIENT_ID);
  const clientSecret = clean(process.env.WCL_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error("WCL_CLIENT_ID and WCL_CLIENT_SECRET are required.");
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`OAuth failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  const token = clean((JSON.parse(body) as { access_token?: string }).access_token);
  if (!token) throw new Error("OAuth returned no access token.");
  return token;
}

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>, attempt = 1): Promise<T> {
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.text();
  if ((!response.ok || response.status === 429) && attempt < 6) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 3_000 * 2 ** (attempt - 1))));
    return graphql<T>(token, query, variables, attempt + 1);
  }
  if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}: ${body.slice(0, 500)}`);
  const parsed = JSON.parse(body) as { data?: T; errors?: Array<{ message?: string }> };
  if (parsed.errors?.length) throw new Error(parsed.errors.map((error) => error.message ?? "Unknown error").join("; "));
  if (!parsed.data) throw new Error("GraphQL returned no data.");
  return parsed.data;
}

const reportQuery = `
query UnknownReportAudit($code: String!, $fightIDs: [Int]) {
  reportData {
    report(code: $code) {
      masterData(translate: true) {
        actors { id gameID name type subType petOwner server icon }
      }
      fights(fightIDs: $fightIDs, translate: true) {
        id name friendlyPlayers
        friendlyPets { id gameID petOwner }
        friendlyNPCs { id gameID petOwner }
      }
    }
  }
}`;

const characterLookupQuery = `
query UnknownCharacterLookup($id: Int!, $name: String!, $serverSlug: String!) {
  characterData {
    byId: character(id: $id) { id canonicalID name classID level server { name slug } }
    byName: character(name: $name, serverSlug: $serverSlug, serverRegion: "US") {
      id canonicalID name classID level server { name slug }
    }
  }
  gameData { classes { id name slug } }
}`;

const characters = JSON.parse(await fs.readFile(charactersPath, "utf8")) as CharacterRecord[];
const unknowns = characters.flatMap((character) =>
  (character.appearances ?? [])
    .filter((appearance) => appearance.className === "Unknown")
    .map((appearance) => ({ characterName: character.name, ...appearance })),
);
const byReport = new Map<string, typeof unknowns>();
for (const appearance of unknowns) {
  byReport.set(appearance.reportCode, [...(byReport.get(appearance.reportCode) ?? []), appearance]);
}

const token = await accessToken();
const results: unknown[] = [];
for (const [reportCode, appearances] of byReport) {
  const fightIDs = [...new Set(appearances.map((appearance) => appearance.fightId))];
  const data = await graphql<{ reportData?: { report?: ReportAudit | null } | null }>(token, reportQuery, {
    code: reportCode,
    fightIDs,
  });
  const report = data.reportData?.report;
  if (!report) throw new Error(`Report ${reportCode} was not returned.`);
  const actors = report.masterData?.actors ?? [];
  const actorById = new Map(actors.filter((actor) => actor.id).map((actor) => [Number(actor.id), actor]));

  for (const appearance of appearances) {
    const fight = (report.fights ?? []).find((candidate) => Number(candidate.id) === appearance.fightId);
    const matchingActors = actors.filter((actor) => nameKey(actor.name) === nameKey(appearance.characterName));
    const actorAudits = [];
    for (const actor of matchingActors) {
      const actorId = Number(actor.id);
      const gameId = Number(actor.gameID);
      const lookup = Number.isFinite(gameId) && actor.server
        ? await graphql<{
            characterData?: {
              byId?: { classID?: number | null } | null;
              byName?: { classID?: number | null } | null;
            } | null;
            gameData?: { classes?: Array<{ id: number; name: string; slug: string }> | null } | null;
          }>(token, characterLookupQuery, {
            id: gameId,
            name: clean(actor.name),
            serverSlug: clean(actor.server).toLocaleLowerCase(),
          })
        : null;
      const character = lookup?.characterData?.byId ?? lookup?.characterData?.byName ?? null;
      const classID = character?.classID ?? null;
      const resolvedClass = lookup?.gameData?.classes?.find((item) => item.id === classID) ?? null;
      actorAudits.push({
        ...actor,
        petOwnerActor: actor.petOwner ? actorById.get(Number(actor.petOwner)) ?? null : null,
        listedAsFriendlyPlayer: Boolean(fight?.friendlyPlayers?.includes(actorId)),
        listedAsFriendlyPet: Boolean(fight?.friendlyPets?.some((unit) => Number(unit.id) === actorId)),
        listedAsFriendlyNpc: Boolean(fight?.friendlyNPCs?.some((unit) => Number(unit.id) === actorId)),
        characterLookup: lookup?.characterData ?? null,
        resolvedClass,
      });
    }
    results.push({
      ...appearance,
      fight,
      actors: actorAudits,
    });
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  unknownAppearances: unknowns.length,
  unknownCharacterNames: new Set(unknowns.map((appearance) => nameKey(appearance.characterName))).size,
  reports: byReport.size,
  results,
};
await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Audited ${output.unknownCharacterNames} unknown character names across ${output.reports} reports.`);
console.log(`Wrote ${path.relative(root, outputPath)}`);
