import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Web search adds 10-20s per request; default 30s isn't always enough,
// especially when the model makes 2-3 searches.
export const maxDuration = 60;

const client = new Anthropic();

// Constant system prompt — mark cacheable so back-to-back analyses reuse it.
const SYSTEM = `You are a sharp sports betting analyst. Given a single game (two teams, current odds, time), search the web for the most recent injury reports, last-5-game form, head-to-head history, and any newsworthy context (travel, weather for outdoor games, suspensions). Use 2-3 targeted searches max.

Then reply with ONLY a JSON object — no prose, no markdown — matching this shape exactly:

{
  "pick": "<team name verbatim from input> | SKIP",
  "confidence": "high | medium | low",
  "reasoning": "2-3 sentences explaining the pick based on what you actually found",
  "injuries": "key injury info found or \"none\"",
  "form": "<team1>: W-L last 5, <team2>: W-L last 5",
  "edge": "what gives this pick its edge",
  "warning": "any red flag or null",
  "avoid": true | false
}

Rules:
- If your research can't justify a confident lean, set pick to "SKIP" and avoid to true.
- Use the team names exactly as given (don't reformat).
- Don't fabricate stats — if a search returned nothing useful, say so in reasoning.`;

type GameAnalysis = {
  pick: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  injuries: string;
  form: string;
  edge: string;
  warning: string | null;
  avoid: boolean;
};

function coerceAnalysis(parsed: unknown, team1: string, team2: string): GameAnalysis {
  if (!parsed || typeof parsed !== "object") {
    return { pick: "SKIP", confidence: "low", reasoning: "Analysis unavailable.", injuries: "none", form: "", edge: "", warning: null, avoid: true };
  }
  const p = parsed as Record<string, unknown>;
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);
  const validPick = (v: unknown): string => {
    const s = str(v);
    if (s === team1 || s === team2 || s.toUpperCase() === "SKIP") return s.toUpperCase() === "SKIP" ? "SKIP" : s;
    // Fuzzy match: pick whichever team name the model's value contains.
    if (s.toLowerCase().includes(team1.toLowerCase())) return team1;
    if (s.toLowerCase().includes(team2.toLowerCase())) return team2;
    return "SKIP";
  };
  const conf = str(p.confidence, "medium").toLowerCase();
  const confidence: "high" | "medium" | "low" =
    conf === "high" || conf === "medium" || conf === "low" ? conf : "medium";
  const rawWarning = p.warning;
  const warning =
    typeof rawWarning === "string" && rawWarning.trim() && rawWarning.trim().toLowerCase() !== "null"
      ? rawWarning.trim()
      : null;
  return {
    pick: validPick(p.pick),
    confidence,
    reasoning: str(p.reasoning, "No reasoning returned."),
    injuries: str(p.injuries, "none"),
    form: str(p.form),
    edge: str(p.edge),
    warning,
    avoid: Boolean(p.avoid),
  };
}

export async function POST(req: NextRequest) {
  let body: {
    team1?: unknown;
    team2?: unknown;
    sport?: unknown;
    odds1?: unknown;
    odds2?: unknown;
    gameTime?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const team1 = typeof body.team1 === "string" ? body.team1.trim() : "";
  const team2 = typeof body.team2 === "string" ? body.team2.trim() : "";
  const sport = typeof body.sport === "string" ? body.sport : "unknown sport";
  const odds1 = typeof body.odds1 === "number" || typeof body.odds1 === "string" ? body.odds1 : "?";
  const odds2 = typeof body.odds2 === "number" || typeof body.odds2 === "string" ? body.odds2 : "?";
  const gameTime = typeof body.gameTime === "string" ? body.gameTime : "unknown";

  if (!team1 || !team2) {
    return NextResponse.json({ error: "Missing team1/team2" }, { status: 400 });
  }
  if (team1.length > 100 || team2.length > 100) {
    return NextResponse.json({ error: "Team names too long" }, { status: 413 });
  }

  const userContent = `Sport: ${sport}
Game: ${team1} vs ${team2}
Time: ${gameTime}
Current odds: ${team1} at ${odds1}, ${team2} at ${odds2}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          // Bound the cost: at most 3 searches per request.
          max_uses: 3,
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    // Web search responses include tool_use + tool_result blocks alongside the
    // final text block. Grab only text blocks for parsing.
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
    }
    if (parsed === undefined) {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw: text.slice(0, 300) },
        { status: 502 },
      );
    }

    return NextResponse.json(coerceAnalysis(parsed, team1, team2));
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${err.status}): ${err.message}` },
        { status: err.status ?? 500 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
