import { jsonError, verifyFirebaseRequest } from "../_lib/firebase-auth.js";

function value(input, max = 300) {
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

  const lang = body.lang === "ru" ? "Russian" : "Romanian";
  const prompt = [
    `Answer in ${lang}. You are a thoughtful birthday gift advisor.`,
    "Offer exactly 5 practical, distinct gift ideas. For each, include why it fits and an approximate price range.",
    "Be warm, concise, culturally neutral, and avoid unsafe, age-restricted, medical, or financial products.",
    `Person: ${value(body.name, 80) || "unspecified"}`,
    `Relationship: ${value(body.relation, 40) || "unspecified"}`,
    `Interests: ${value(body.interests) || "unspecified"}`,
    `Existing idea: ${value(body.gift) || "none"}`,
    `Notes: ${value(body.note) || "none"}`,
    `Budget: ${Number(body.budget) > 0 ? `${Number(body.budget)} ${value(body.currency, 8)}` : "flexible"}`
  ].join("\n");

  try {
    const response = await context.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "Give useful gift suggestions. Never claim personal knowledge beyond the supplied profile." },
        { role: "user", content: prompt }
      ],
      max_tokens: 650,
      temperature: 0.65
    });
    const advice = value(response?.response, 5000);
    if (!advice) return jsonError("EMPTY_AI_RESPONSE", 502);
    return Response.json({ advice }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gift AI failed", error);
    return jsonError("AI_UNAVAILABLE", 503);
  }
}

export function onRequest() {
  return jsonError("METHOD_NOT_ALLOWED", 405);
}

