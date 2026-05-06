import { config as loadEnv } from "dotenv";

type GraphQlError = {
  message?: string;
};

type GraphQlResponse<T> = {
  data?: T;
  errors?: GraphQlError[];
};

type GuildProgressResponse = {
  progressRaceData?: {
    progressRace?: unknown;
  } | null;
};

const endpoint = "https://classic.warcraftlogs.com/api/v2/client";
const tokenEndpoint = "https://www.warcraftlogs.com/oauth/token";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

const guildId = Number(process.env.WCL_DEBUG_GUILD_ID ?? 619658);
const guildName = process.env.WCL_DEBUG_GUILD_NAME ?? "Inept";
const serverSlug = process.env.WCL_DEBUG_SERVER_SLUG ?? "grobbulus";
const serverRegion = process.env.WCL_DEBUG_SERVER_REGION ?? "US";
const zoneId = Number(process.env.WCL_DEBUG_ZONE_ID ?? 1010);
const difficulty = Number(process.env.WCL_DEBUG_DIFFICULTY ?? 3);
const size = Number(process.env.WCL_DEBUG_SIZE ?? 25);
const tier5BossNames = [
  "Hydross the Unstable",
  "The Lurker Below",
  "Leotheras the Blind",
  "Fathom-Lord Karathress",
  "Morogrim Tidewalker",
  "Lady Vashj",
  "Al'ar",
  "Void Reaver",
  "High Astromancer Solarian",
  "Kael'thas Sunstrider",
];

const progressArgsQuery = `
query ProgressSchema {
  progressRaceDataType: __type(name: "ProgressRaceData") {
    fields {
      name
      args {
        name
      }
    }
  }
}
`;

const progressRaceQuery = `
query GuildProgressRace($guildId: Int!, $zoneId: Int!, $difficulty: Int!, $size: Int!) {
  progressRaceData {
    progressRace(guildID: $guildId, zoneID: $zoneId, difficulty: $difficulty, size: $size)
  }
}
`;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value: unknown) {
  const parsed = toNumber(value);

  if (parsed === null || parsed <= 0) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function requestAccessToken() {
  const clientId = cleanText(process.env.WCL_CLIENT_ID);
  const clientSecret = cleanText(process.env.WCL_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    console.log("Skipping WCL guild progress debug: missing credentials.");
    return null;
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Warcraft Logs OAuth failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  return cleanText((JSON.parse(body) as { access_token?: string }).access_token);
}

async function requestGraphQl<T>(accessToken: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Warcraft Logs GraphQL failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const parsed = JSON.parse(body) as GraphQlResponse<T>;

  if (parsed.errors?.length) {
    throw new Error(`Warcraft Logs GraphQL errors: ${parsed.errors.map((error) => error.message ?? "Unknown error").join("; ")}`);
  }

  if (!parsed.data) {
    throw new Error("Warcraft Logs GraphQL response did not include data.");
  }

  return parsed.data;
}

function collectObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (!value || typeof value !== "object") {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjects(item, output);
    }

    return output;
  }

  const objectValue = value as Record<string, unknown>;
  output.push(objectValue);

  for (const item of Object.values(objectValue)) {
    collectObjects(item, output);
  }

  return output;
}

function findProgressGuildPayload(payload: unknown) {
  const candidates = collectObjects(payload).filter((objectValue) => Array.isArray(objectValue.encounters));

  return (
    candidates.find((candidate) => toNumber(candidate.id) === guildId) ??
    candidates.find((candidate) => cleanText(candidate.name).toLowerCase() === guildName.toLowerCase()) ??
    candidates[0] ??
    null
  );
}

function getEncounterRows(payload: Record<string, unknown>) {
  const encounters = Array.isArray(payload.encounters) ? payload.encounters.filter(isRecord) : [];

  return tier5BossNames.map((bossName) => {
    const encounter = encounters.find((candidate) => cleanText(candidate.name) === bossName);

    return {
      bossName,
      found: Boolean(encounter),
      killed: encounter?.isKilled === true,
      killedAt: toIsoString(encounter?.killedAtTimestamp),
      bestPercent: toNumber(encounter?.bestPercent),
      pulls: toNumber(encounter?.pullCount),
    };
  });
}

async function run() {
  const accessToken = await requestAccessToken();

  if (!accessToken) {
    return;
  }

  const schema = await requestGraphQl<Record<string, unknown>>(accessToken, progressArgsQuery, {});
  const progressRaceField = (schema.progressRaceDataType as { fields?: Array<{ name?: string; args?: Array<{ name?: string }> }> } | undefined)?.fields?.find(
    (field) => field.name === "progressRace",
  );
  console.log(`WCL progressRace args: ${progressRaceField?.args?.map((arg) => arg.name).join(", ") || "unknown"}`);
  console.log(`WCL guild progress debug: guild ${guildId} (${guildName} - ${serverSlug}, ${serverRegion}), zone ${zoneId}, difficulty ${difficulty}, size ${size}`);

  const data = await requestGraphQl<GuildProgressResponse>(accessToken, progressRaceQuery, {
    guildId,
    zoneId,
    difficulty,
    size,
  });
  const payload = findProgressGuildPayload(data.progressRaceData?.progressRace);

  if (!payload) {
    console.log("No guild progress encounter payload was returned.");
    return;
  }

  console.log(`Guild: ${cleanText(payload.name) || guildName}`);
  console.log(`Killed count: ${toNumber(payload.killedCount) ?? "unknown"}`);
  console.log("");
  console.log("Boss progress");

  for (const row of getEncounterRows(payload)) {
    console.log(
      `- ${row.bossName}: ${row.found ? (row.killed ? "Killed" : "Not killed") : "Missing"}${
        row.killedAt ? ` at ${row.killedAt}` : ""
      }${row.bestPercent !== null ? `, best ${row.bestPercent}%` : ""}${row.pulls !== null ? `, pulls ${row.pulls}` : ""}`,
    );
  }
}

await run().catch((error: unknown) => {
  console.error(`WCL guild progress debug failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
