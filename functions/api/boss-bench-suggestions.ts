import { hasOfficerPasswordConfig, hasValidOfficerSession, jsonResponse, type OfficerAuthEnv } from "../_shared/officer-auth";
import { getBossBenchSuggestionText } from "../../src/lib/benchSuggestions";

interface PagesContext {
  request: Request;
  env: OfficerAuthEnv;
}

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

  return jsonResponse({ ok: true, text: getBossBenchSuggestionText() });
};
