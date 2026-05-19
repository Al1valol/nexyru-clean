import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

// System prompt is constant — mark it cacheable. Daily briefing requests
// re-use the same instructions; cache reads cut cost + latency.
const SYSTEM = `You are JARVIS, the AI assistant from Iron Man. You are giving a personalized morning briefing to a trader/investor. Be smart, confident, slightly witty, and genuinely helpful. Use "Sir" occasionally. Keep it sharp and actionable.

Generate a briefing with these exact sections — each label in ALL CAPS followed by a colon, then the content:

GREETING: Personalized good morning, mention the date, set the tone.
OVERNIGHT_REPORT: What happened while they were away. Comment on any overnight crypto positions specifically by name. Warn if they held meme coins overnight (high risk).
OPPORTUNITIES: Today's best opportunities across trading, crypto, and sports betting. Be specific. If arbs found, explain the opportunity. If crypto is open, discuss.
WARNINGS: Risks to watch out for. Include: too many pending arbs (bookmakers ban arbers), meme coins held too long, recent losses suggesting a losing streak.
GOALS: 3-5 specific actionable goals for today as a numbered list. Smart and achievable.
MOTIVATION: One sharp, motivating closing line. Iron Man style.

Total response under 400 words. Conversational, smart, occasionally witty.`;

export async function POST(req: Request) {
  let body: {
    date?: unknown;
    trading?: unknown;
    crypto?: unknown;
    odds?: unknown;
    bets?: unknown;
    arbs?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Pull data with defensive fallbacks — the client gathers from localStorage
  // so any shape may be missing.
  const t = (body.trading ?? {}) as Record<string, unknown>;
  const c = (body.crypto ?? {}) as Record<string, unknown>;
  const o = (body.odds ?? {}) as Record<string, unknown>;
  const b = (body.bets ?? {}) as Record<string, unknown>;
  const a = (body.arbs ?? {}) as Record<string, unknown>;

  const overnightSymbols = Array.isArray((c as { overnightPositions?: unknown }).overnightPositions)
    ? ((c as { overnightPositions: Array<{ symbol?: string }> }).overnightPositions
        .map((p) => p.symbol).filter(Boolean).join(", "))
    : "";

  const date = typeof body.date === "string"
    ? body.date
    : new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const userContent = `Today's date: ${date}

TRADING JOURNAL:
- Total trades logged: ${t.totalTrades ?? 0}
- Trades today: ${t.todayTrades ?? 0}
- Today's P&L: $${Number(t.todayPnl ?? 0).toFixed(2)}
- Win rate: ${t.winRate ?? 0}%
- Recent losses (last 3 days): ${t.recentLosses ?? 0}

CRYPTO POSITIONS:
- Open positions: ${(c as { openPositionsCount?: number }).openPositionsCount ?? 0}
- Positions held overnight: ${(c as { overnightCount?: number }).overnightCount ?? 0}
- Total value in crypto: $${Number((c as { totalValue?: unknown }).totalValue ?? 0).toFixed(2)}
${overnightSymbols ? `- Overnight coins: ${overnightSymbols}` : ""}

SPORTS BETTING:
- Arb opportunities found today: ${o.arbsFound ?? 0}
- Total games analyzed: ${o.totalGames ?? 0}
- Pending paper bets: ${b.pendingBets ?? 0}
- Tracked arbs pending: ${a.pendingArbs ?? 0}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content
      .filter((blk): blk is Anthropic.TextBlock => blk.type === "text")
      .map((blk) => blk.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      text,
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
      { error: err instanceof Error ? err.message : "Briefing failed" },
      { status: 500 },
    );
  }
}
