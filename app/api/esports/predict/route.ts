import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

// System prompt is constant — mark cacheable so back-to-back match predictions
// reuse the prefix and stay cheap.
const SYSTEM = `You are an esports analyst. Predict the winner of a match.

Reply with ONLY a JSON object — no prose, no markdown — exactly like this:
{"winner": "Team name as given", "confidence": "high|medium|low", "probability": 65, "reasoning": "one sentence why", "bet": "BET <winner>|SKIP", "betReason": "one sentence on the bet"}

Rules:
- winner = the team name you predict will win, verbatim as given
- probability = your honest win probability for that team, integer 0-100
- confidence: high if you're sure, medium if it's a lean, low if it's close
- bet: "BET <winner name>" if you'd back them at fair odds, "SKIP" if too close to call or you'd avoid

Be realistic. A higher-ranked team is usually favored. BO1 is high variance; BO3/BO5 are skill-based.`;

export async function POST(req: Request) {
  let body: {
    team1?: unknown;
    team2?: unknown;
    team1Rank?: unknown;
    team2Rank?: unknown;
    tournament?: unknown;
    format?: unknown;
    game?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const team1 = typeof body.team1 === "string" ? body.team1.trim() : "";
  const team2 = typeof body.team2 === "string" ? body.team2.trim() : "";
  const game = typeof body.game === "string" ? body.game : "esports";
  const tournament = typeof body.tournament === "string" ? body.tournament : "Unknown";
  const format = typeof body.format === "string" ? body.format : "Best of ?";
  const r1 = typeof body.team1Rank === "number" ? body.team1Rank : 999;
  const r2 = typeof body.team2Rank === "number" ? body.team2Rank : 999;

  if (!team1 || !team2) {
    return NextResponse.json({ error: "Missing team1/team2" }, { status: 400 });
  }
  if (team1.length > 100 || team2.length > 100) {
    return NextResponse.json({ error: "Team names too long" }, { status: 413 });
  }

  const rankLabel = (r: number) => (r >= 999 ? "Unknown" : `#${r}`);
  const userContent = `Game: ${game}
${team1} (Rank ${rankLabel(r1)}) vs ${team2} (Rank ${rankLabel(r2)})
Tournament: ${tournament}
Format: ${format}`;

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
      .replace(/```json|```/g, "")
      .trim();

    let parsed: {
      winner?: unknown;
      confidence?: unknown;
      probability?: unknown;
      reasoning?: unknown;
      bet?: unknown;
      betReason?: unknown;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw: text.slice(0, 200) },
        { status: 502 },
      );
    }

    const winner =
      typeof parsed.winner === "string" && parsed.winner.trim()
        ? parsed.winner.trim()
        : team1;
    const probability =
      typeof parsed.probability === "number" && parsed.probability >= 0 && parsed.probability <= 100
        ? Math.round(parsed.probability)
        : 50;
    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium";
    const reasoning =
      typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
    const bet = typeof parsed.bet === "string" ? parsed.bet.trim() : "SKIP";
    const betReason =
      typeof parsed.betReason === "string" ? parsed.betReason.trim() : "";

    return NextResponse.json({
      winner,
      confidence,
      probability,
      reasoning,
      bet,
      betReason,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Prediction failed" },
      { status: 500 },
    );
  }
}
