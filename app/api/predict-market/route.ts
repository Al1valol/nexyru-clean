import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

// System prompt is constant across requests, so mark it cacheable. Saves
// tokens when the user clicks "Predict Top 5" or fires multiple predictions
// in close succession.
const SYSTEM = `You are a prediction market analyst. Estimate the probability of the event in the user's question actually happening.

Reply with ONLY a JSON object — no prose, no markdown — exactly like this:
{"probability": 65, "confidence": "medium", "reasoning": "one sentence why"}

probability = your honest estimate, integer 0-100
confidence = "high" | "medium" | "low"
reasoning = one short sentence explanation

Be realistic and data-driven. Consider base rates and prior similar events. Do not anchor on the current market price.`;

export async function POST(req: Request) {
  let body: { question?: unknown; yesPrice?: unknown; volume?: unknown; endDate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const yesPrice = typeof body.yesPrice === "number" ? body.yesPrice : parseFloat(String(body.yesPrice ?? ""));
  const endDate = typeof body.endDate === "string" ? body.endDate : "unknown";

  if (!question) return NextResponse.json({ error: "Missing 'question'" }, { status: 400 });
  if (question.length > 2_000) return NextResponse.json({ error: "Question too long" }, { status: 413 });
  if (!Number.isFinite(yesPrice)) return NextResponse.json({ error: "Missing 'yesPrice'" }, { status: 400 });

  const userContent = `Question: "${question}"
Market ends: ${endDate}
Current market price: YES at ${(yesPrice * 100).toFixed(0)}%`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let parsed: { probability?: unknown; confidence?: unknown; reasoning?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw: text }, { status: 502 });
    }

    const prob = typeof parsed.probability === "number"
      ? parsed.probability
      : parseFloat(String(parsed.probability));
    if (!Number.isFinite(prob)) {
      return NextResponse.json({ error: "Missing probability", raw: text }, { status: 502 });
    }

    return NextResponse.json({
      probability: Math.max(0, Math.min(100, Math.round(prob))),
      confidence: typeof parsed.confidence === "string" ? parsed.confidence : "medium",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_read_input_tokens: message.usage.cache_read_input_tokens,
        cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${err.status}): ${err.message}` },
        { status: err.status ?? 500 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Prediction failed" },
      { status: 500 },
    );
  }
}
