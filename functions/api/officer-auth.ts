import {
  createOfficerSessionCookie,
  hasOfficerPasswordConfig,
  isValidOfficerPassword,
  jsonResponse,
  safeParseJson,
  type OfficerAuthEnv,
} from "../_shared/officer-auth";

interface PagesContext {
  request: Request;
  env: OfficerAuthEnv;
}

const AUTH_ERROR_MESSAGE = "Unable to verify officer access.";

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405, { Allow: "POST" });
  }

  if (!hasOfficerPasswordConfig(env)) {
    console.error("[officer-auth] No officer password or password hash is configured.");
    return jsonResponse({ ok: false, message: AUTH_ERROR_MESSAGE }, 500);
  }

  const body = await safeParseJson(request);
  const password =
    body && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : "";

  if (!password || !(await isValidOfficerPassword(password, env))) {
    return jsonResponse({ ok: false, message: "Invalid password." }, 401);
  }

  return jsonResponse(
    { ok: true, message: "Officer access unlocked." },
    200,
    { "Set-Cookie": await createOfficerSessionCookie(env) },
  );
};
