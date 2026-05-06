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
const zoneId = Number(process.env.WCL_DEBUG_ZONE_ID ?? 1010);
const difficultyValues = [undefined, 3, 4];
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

const progressRaceQuery = `
query GuildProgress($guildId: Int!, $zoneId: Int!, $difficulty: Int) {
  progressRaceData {
    progressRace(guildID: $guildId, zoneID: $zoneId, difficulty: $difficulty)
  }
}
`;

const introspectionQuery = `
query ProgressSchema {
  progressRaceDataType: __type(name: "ProgressRaceData") {
    fields {
      name
      args {
        name
        type {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }
  }
  guildType: __type(name: "Guild") {
    fields {
      name
      args {
        name
      }
    }
  }
}
`;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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

function summarizeProgressPayload(payload: unknown) {
  const json = JSON.stringify(payload);
  const objects = collectObjects(payload);
  const topLevelKeys = payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload as Record<string, unknown>) : [];

  console.log(`payload type: ${Array.isArray(payload) ? "array" : typeof payload}`);
  console.log(`payload bytes: ${json.length}`);
  console.log(`top-level keys: ${topLevelKeys.join(", ") || "none"}`);
  console.log(`objects scanned: ${objects.length}`);

  for (const bossName of tier5BossNames) {
    const matchingObjects = objects.filter((objectValue) => JSON.stringify(objectValue).includes(bossName));
    const killishObjects = matchingObjects.filter((objectValue) => /kill|defeat|complete/i.test(JSON.stringify(objectValue)));

    console.log(`${bossName}: ${matchingObjects.length} object(s), ${killishObjects.length} kill/progress-ish object(s)`);

    for (const objectValue of matchingObjects.slice(0, 2)) {
      console.log(JSON.stringify(objectValue, null, 2).slice(0, 1200));
    }
  }
}

async function run() {
  const accessToken = await requestAccessToken();

  if (!accessToken) {
    return;
  }

  const schema = await requestGraphQl<Record<string, unknown>>(accessToken, introspectionQuery, {});
  console.log("WCL guild progress schema snapshot");
  console.log(JSON.stringify(schema, null, 2).slice(0, 5000));

  for (const difficulty of difficultyValues) {
    console.log("");
    console.log(`WCL guild progress debug: guild ${guildId}, zone ${zoneId}, difficulty ${difficulty ?? "none"}`);
    const data = await requestGraphQl<GuildProgressResponse>(accessToken, progressRaceQuery, {
      guildId,
      zoneId,
      difficulty: difficulty ?? null,
    });

    summarizeProgressPayload(data.progressRaceData?.progressRace);
  }
}

await run().catch((error: unknown) => {
  console.error(`WCL guild progress debug failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
