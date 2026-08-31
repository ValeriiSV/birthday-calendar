import { jsonError, verifyFirebaseRequest } from "../_lib/firebase-auth.js";

function value(input, max = 500) {
  return String(input || "").trim().slice(0, max);
}

export async function onRequestPost(context) {
  try {
    await verifyFirebaseRequest(context.request);
  } catch {
    return jsonError("UNAUTHORIZED", 401);
  }
  if (!context.env.AI) return jsonError("AI_BINDING_MISSING", 503);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("INVALID_JSON");
  }
  const interests = value(body.interests);
  const description = value(body.description);
  if (!interests && !description) return jsonError("DESCRIPTION_REQUIRED");

  const cardMode = body.mode === "card";
  const prompt = [
    cardMode ? "A premium vertical greeting card background, 4:5 composition, elegant central negative space for later typography, joyful and sophisticated." : "A beautiful square birthday profile illustration, premium editorial style, joyful and warm, elegant soft lighting, harmonious colors, polished composition.",
    `Visual themes inspired by these interests: ${interests || "celebration and friendship"}.`,
    description ? `Additional mood and details: ${description}.` : "",
    "No text, no letters, no logos, no watermark. Create a symbolic illustration, not the likeness of a real person."
  ].filter(Boolean).join(" ").slice(0, 1800);

  try {
    const response = await context.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      steps: 6,
      seed: crypto.getRandomValues(new Uint32Array(1))[0]
    });
    if (!response?.image) return jsonError("EMPTY_AI_RESPONSE", 502);
    return Response.json({ dataURI: `data:image/jpeg;base64,${response.image}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ message: "image_ai_failed", mode: cardMode ? "card" : "profile", error: error instanceof Error ? error.message : String(error) }));
    return jsonError("AI_UNAVAILABLE", 503);
  }
}

export function onRequest() {
  return jsonError("METHOD_NOT_ALLOWED", 405);
}
