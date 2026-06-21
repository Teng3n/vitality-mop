import { hasOfficerPasswordConfig, hasValidOfficerSession, jsonResponse, type OfficerAuthEnv } from "../_shared/officer-auth";
import { getBenchSuggestionText } from "../../src/lib/benchSuggestions";

interface PagesContext {
  request: Request;
  env: OfficerAuthEnv;
}

const getRequestedRaidDate = (request: Request) => {
  const date = new URL(request.url).searchParams.get("date")?.trim();
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
};

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405, { Allow: "GET" });
  }

  if (!hasOfficerPasswordConfig(env)) {
    console.error("[bench-suggestions] No officer password or password hash is configured.");
    return jsonResponse({ ok: false, message: "Unable to generate bench suggestions." }, 500);
  }

  if (!(await hasValidOfficerSession(request, env))) {
    return jsonResponse({ ok: false, message: "Officer access required." }, 401);
  }

  return jsonResponse({ ok: true, text: getBenchSuggestionText(getRequestedRaidDate(request)) });
};
