import { hasOfficerPasswordConfig, hasValidOfficerSession, jsonResponse, type OfficerAuthEnv } from "../_shared/officer-auth";
import { getGearNeedsReport, getGearNeedsText } from "../../src/lib/gearNeeds";

interface PagesContext {
  request: Request;
  env: OfficerAuthEnv;
}

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405, { Allow: "GET" });
  }

  if (!hasOfficerPasswordConfig(env)) {
    console.error("[gear-needs] No officer password or password hash is configured.");
    return jsonResponse({ ok: false, message: "Unable to load gear needs." }, 500);
  }

  if (!(await hasValidOfficerSession(request, env))) {
    return jsonResponse({ ok: false, message: "Officer access required." }, 401);
  }

  const report = getGearNeedsReport();
  return jsonResponse({ ok: true, report, text: getGearNeedsText(report) });
};
