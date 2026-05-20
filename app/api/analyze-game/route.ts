import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Web search adds 10-20s per request; default 30s isn't always enough,
// especially when the model makes 2-3 searches.
export const maxDuration = 60;

const client = new Anthropic();

// Constant system prompt — mark cacheable so back-to-back analyses reuse it.
// No live data: web search removed to cut cost. Reasoning is grounded in
// training knowledge with an explicit disclaimer for users to verify
// time-sensitive details (injuries) on real sources.
const SYSTEM = `You are a sharp sports betting analyst with knowledge up to early 2026. Analyze the given game using your training knowledge — no live web data.

Reply with ONLY a JSON object — no prose, no markdown — matching this shape exactly:

{
  "pick": "<team name verbatim from input> | SKIP",
  "confidence": "high | medium | low",
  "reasoning": "2-3 sentences based on team quality and historical performance",
  "injuries": "any known injury concerns or \"none\"",
  "form": "general team quality assessment",
  "edge": "what gives this pick its edge",
  "warning": "any red flag or null",
  "avoid": true | false
}

Rules:
- If you can't justify a confident lean from your knowledge, set pick to "SKIP" and avoid to true.
- Use the team names exactly as given (don't reformat).
- Don't invent specific recent stats or injuries you can't verify; speak in general team-quality terms.
- For current injuries always recommend the user verify on ESPN or the team's official site.`;

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
    return {
      pick: "SKIP",
      confidence: "low",
      reasoning: "Analysis unavailable — please check ESPN for current team news",
      injuries: "none",
      form: "N/A",
      edge: "N/A",
      warning: null,
      avoid: false,
    };
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
      max_tokens: 300,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Three parsing strategies in order — never error to the client. With
    // max_tokens=300, truncation is common, so strategy 3 (per-field regex)
    // exists to salvage fields out of a truncated/unclosed JSON object.
    let parsed: unknown = null;

    // Strategy 1: strip code fences, parse whole text.
    try {
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {}

    // Strategy 2: extract first {...} block and parse it.
    if (!parsed) {
      try {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      } catch {}
    }

    // Strategy 3: per-field regex — works on truncated JSON without a closing
    // brace. Only triggers if at minimum we can identify a pick.
    if (!parsed) {
      const pickMatch = text.match(/"pick"\s*:\s*"([^"]+)"/);
      if (pickMatch) {
        const grab = (key: string) => text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))?.[1];
        const avoidMatch = text.match(/"avoid"\s*:\s*(true|false)/);
        parsed = {
          pick: pickMatch[1],
          confidence: grab("confidence") || "medium",
          reasoning: grab("reasoning") || "Analysis based on team history",
          injuries: grab("injuries") || "none",
          form: grab("form") || "N/A",
          edge: grab("edge") || "N/A",
          warning: grab("warning") || null,
          avoid: avoidMatch?.[1] === "true",
        };
      }
    }

    // Strategy 4 (the safe fallback) is inside coerceAnalysis: when parsed is
    // null/non-object, it returns the "Analysis unavailable" GameAnalysis.
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
