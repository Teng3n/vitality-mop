interface Env {
  GITHUB_ACTIONS_DISPATCH_TOKEN?: string;
  SYNC_TRIGGER_PASSWORD?: string;
  SYNC_TRIGGER_PASSWORD_HASH?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const GITHUB_DISPATCH_URL =
  "https://api.github.com/repos/Teng3n/vitality-mop/actions/workflows/sync-data.yml/dispatches";
const WORKFLOW_REF = "feature/guild-site-mvp";
const COOLDOWN_MS = 60_000;
const SYNC_ERROR_MESSAGE = "Unable to trigger sync workflow.";

let lastTriggerAt = 0;

const encoder = new TextEncoder();

const jsonResponse = (body: Record<string, unknown>, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

const safeParseJson = async (request: Request) => {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
};

const timingSafeEqual = (actual: string, expected: string) => {
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  let diff = actualBytes.length ^ expectedBytes.length;
  const length = Math.max(actualBytes.length, expectedBytes.length);

  for (let index = 0; index < length; index += 1) {
    diff |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return diff === 0;
};

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isValidPassword = async (password: string, env: Env) => {
  const expectedHash = env.SYNC_TRIGGER_PASSWORD_HASH?.trim().toLowerCase();

  if (expectedHash) {
    return timingSafeEqual(await sha256Hex(password), expectedHash);
  }

  const expectedPassword = env.SYNC_TRIGGER_PASSWORD;
  return expectedPassword ? timingSafeEqual(password, expectedPassword) : false;
};

const logGitHubDispatchFailure = (status: number, body: string) => {
  console.error("[trigger-sync] GitHub workflow dispatch failed.", {
    status,
    body,
  });

  if (status === 401 || status === 403) {
    console.error("[trigger-sync] GitHub dispatch failure is likely a token permission issue.");
  }

  if (status === 404) {
    console.error("[trigger-sync] GitHub dispatch failure is likely a repo, workflow filename, or branch/ref issue.");
  }
};

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405, { Allow: "POST" });
  }

  if (!env.GITHUB_ACTIONS_DISPATCH_TOKEN) {
    console.error("[trigger-sync] GITHUB_ACTIONS_DISPATCH_TOKEN is not configured.");
    return jsonResponse({ ok: false, message: SYNC_ERROR_MESSAGE }, 500);
  }

  if (!env.SYNC_TRIGGER_PASSWORD && !env.SYNC_TRIGGER_PASSWORD_HASH) {
    console.error("[trigger-sync] No sync trigger password or password hash is configured.");
    return jsonResponse({ ok: false, message: SYNC_ERROR_MESSAGE }, 500);
  }

  const body = await safeParseJson(request);
  const password =
    body && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : "";

  if (!password || !(await isValidPassword(password, env))) {
    return jsonResponse({ ok: false, message: "Invalid password." }, 401);
  }

  const now = Date.now();

  if (now - lastTriggerAt < COOLDOWN_MS) {
    return jsonResponse({ ok: false, message: "Sync was triggered recently. Try again shortly." }, 429);
  }

  let githubResponse: Response;

  try {
    githubResponse = await fetch(GITHUB_DISPATCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_ACTIONS_DISPATCH_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "vitality-mop-pages-function",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: WORKFLOW_REF }),
    });
  } catch (error) {
    console.error("[trigger-sync] GitHub workflow dispatch request failed before a response was received.", {
      message: error instanceof Error ? error.message : "Unknown fetch error",
    });
    return jsonResponse({ ok: false, message: SYNC_ERROR_MESSAGE }, 502);
  }

  console.info("[trigger-sync] GitHub workflow dispatch response status.", {
    status: githubResponse.status,
  });

  if (githubResponse.status !== 204) {
    logGitHubDispatchFailure(githubResponse.status, await githubResponse.text());
    return jsonResponse({ ok: false, message: SYNC_ERROR_MESSAGE }, 502);
  }

  console.info("[trigger-sync] GitHub workflow dispatch returned 204.");

  lastTriggerAt = Date.now();

  console.info("[trigger-sync] Returning successful sync trigger response.");

  return jsonResponse({ ok: true, message: "Sync workflow triggered." });
};
