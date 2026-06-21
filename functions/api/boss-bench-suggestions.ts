import { hasOfficerPasswordConfig, hasValidOfficerSession, jsonResponse, type OfficerAuthEnv } from "../_shared/officer-auth";
import { getBossBenchSuggestions, getBossBenchSuggestionSheetText, getBossBenchSuggestionText } from "../../src/lib/benchSuggestions";

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
    console.error("[boss-bench-suggestions] No officer password or password hash is configured.");
    return jsonResponse({ ok: false, message: "Unable to generate boss bench suggestions." }, 500);
  }

  if (!(await hasValidOfficerSession(request, env))) {
    return jsonResponse({ ok: false, message: "Officer access required." }, 401);
  }

  const raidDate = getRequestedRaidDate(request);

  return jsonResponse({
    ok: true,
    text: getBossBenchSuggestionText(raidDate),
    sheetText: getBossBenchSuggestionSheetText(raidDate),
    suggestions: getBossBenchSuggestions(raidDate),
  });
};
