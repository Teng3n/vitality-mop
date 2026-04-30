import { hasOfficerPasswordConfig, hasValidOfficerSession, jsonResponse, type OfficerAuthEnv } from "../_shared/officer-auth";
import { getBenchSuggestionText } from "../../src/lib/benchSuggestions";

interface PagesContext {
  request: Request;
  env: OfficerAuthEnv;
}

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

  return jsonResponse({ ok: true, text: getBenchSuggestionText() });
};
