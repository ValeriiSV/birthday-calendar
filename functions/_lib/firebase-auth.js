const PROJECT_ID = "birthday-calendar-ai";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let cachedKeys = null;
let keysExpireAt = 0;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getKeys() {
  if (cachedKeys && Date.now() < keysExpireAt) return cachedKeys;
  const response = await fetch(JWK_URL);
  if (!response.ok) throw new Error("AUTH_KEYS_UNAVAILABLE");
  const body = await response.json();
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  cachedKeys = body.keys || [];
  keysExpireAt = Date.now() + maxAge * 1000;
  return cachedKeys;
}

export async function verifyFirebaseRequest(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("UNAUTHORIZED");

  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== "RS256" || !header.kid ||
    payload.aud !== PROJECT_ID || payload.iss !== ISSUER ||
    typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128 ||
    typeof payload.exp !== "number" || payload.exp <= now ||
    typeof payload.iat !== "number" || payload.iat > now ||
    typeof payload.auth_time !== "number" || payload.auth_time > now
  ) throw new Error("UNAUTHORIZED");

  const jwk = (await getKeys()).find(key => key.kid === header.kid);
  if (!jwk) throw new Error("UNAUTHORIZED");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("UNAUTHORIZED");
  return payload;
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

