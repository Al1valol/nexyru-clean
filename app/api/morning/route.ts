import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

// System prompt is constant — mark it cacheable. Daily briefing requests
// re-use the same instructions; cache reads cut cost + latency.
const SYSTEM = `You are JARVIS, the AI assistant from Iron Man, giving a personalized morning briefing to a trader/investor. Be smart, confident, slightly witty, and genuinely helpful. Use "Sir" occasionally. Keep it sharp and actionable.

Reply ONLY with valid JSON — no markdown, no backticks, no prose around it. Use this exact shape:

{
  "greeting": "Personalized Iron Man / JARVIS-style greeting, mention the date and time of day. 2-3 sentences.",
  "overnight": "What happened overnight. Comment on any overnight crypto positions by name if listed. Warn about meme coins held overnight. 2-3 sentences.",
  "market_overview": "2-3 sentences on what the crypto market is doing today based on BTC, ETH, and sentiment. Is it a good day to buy or hold?",
  "opportunities": "Best opportunities today across trading, crypto, and sports betting. Be specific and actionable. 3-4 sentences.",
  "warnings": "Risks to watch. If they have overnight meme coins warn them. If too many pending arbs warn about getting banned by bookmakers. Recent-loss streak warnings. 2-3 sentences.",
  "hot_alert": "If there is a hot gem, exceptional arb, or anything genuinely urgent RIGHT NOW, describe it in 2-3 sentences with specific details — name the coin/bet and why it's interesting. If nothing urgent, return null (the JSON literal null, not the string).",
  "goals": ["Goal 1 specific and actionable", "Goal 2 specific and actionable", "Goal 3 specific and actionable", "Goal 4 specific and actionable", "Goal 5 specific and actionable"],
  "motivation": "One sharp Iron Man style closing line under 20 words."
}`;

type Briefing = {
  greeting: string;
  overnight: string;
  market_overview: string;
  opportunities: string;
  warnings: string;
  hot_alert: string | null;
  goals: string[];
  motivation: string;
};

function coerceBriefing(parsed: unknown): Briefing | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const goals = Array.isArray(p.goals)
    ? (p.goals as unknown[]).map((g) => String(g)).filter(Boolean)
    : [];
  // Coerce hot_alert: Claude sometimes returns the string "null" or "None"
  // instead of the JSON literal. Treat those as absent.
  const rawAlert = p.hot_alert;
  const hot_alert =
    typeof rawAlert === "string"
    && rawAlert.trim().length > 0
    && rawAlert.trim().toLowerCase() !== "null"
    && rawAlert.trim().toLowerCase() !== "none"
      ? rawAlert.trim()
      : null;
  // At least one section must be populated for this to count as a usable
  // briefing — otherwise return null and let the route surface an error.
  const text = [p.greeting, p.overnight, p.market_overview, p.opportunities, p.warnings, p.motivation]
    .filter((v) => typeof v === "string" && v.trim().length > 0).length;
  if (text === 0 && goals.length === 0) return null;
  return {
    greeting: str(p.greeting),
    overnight: str(p.overnight),
    market_overview: str(p.market_overview),
    opportunities: str(p.opportunities),
    warnings: str(p.warnings),
    hot_alert,
    goals,
    motivation: str(p.motivation),
  };
}

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

  const t = (body.trading ?? {}) as Record<string, unknown>;
  const c = (body.crypto ?? {}) as Record<string, unknown>;
  const o = (body.odds ?? {}) as Record<string, unknown>;
  const b = (body.bets ?? {}) as Record<string, unknown>;
  const a = (body.arbs ?? {}) as Record<string, unknown>;
  const m = ((body as { markets?: unknown }).markets ?? {}) as Record<string, unknown>;
  const hg = ((body as { hotGem?: unknown }).hotGem ?? null) as
    | { name?: string; symbol?: string; change1h?: number; change24h?: number; chain?: string }
    | null;
  const trendingList = Array.isArray(m.topTrending)
    ? (m.topTrending as Array<{ name?: string; change?: number }>)
      .map((t) => `${t.name ?? "?"} ${Number(t.change ?? 0).toFixed(0)}%`)
      .join(", ")
    : "";

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
- Tracked arbs pending: ${a.pendingArbs ?? 0}

MARKET DATA:
- BTC: $${Number(m.btcPrice ?? 0).toLocaleString()} (${Number(m.btcChange ?? 0).toFixed(1)}% 24h)
- ETH: $${Number(m.ethPrice ?? 0).toLocaleString()} (${Number(m.ethChange ?? 0).toFixed(1)}% 24h)
- Market sentiment: ${m.marketSentiment ?? "unknown"} (${m.gainers ?? 0}/10 top coins up)
${trendingList ? `- Trending: ${trendingList}` : ""}
${hg ? `- HOT GEM RIGHT NOW: ${hg.name} (${hg.symbol}) up ${Number(hg.change1h ?? 0).toFixed(0)}% in 1h on ${hg.chain}` : ""}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const raw = message.content
      .filter((blk): blk is Anthropic.TextBlock => blk.type === "text")
      .map((blk) => blk.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw },
        { status: 502 },
      );
    }

    const briefing = coerceBriefing(parsed);
    if (!briefing) {
      return NextResponse.json(
        { error: "Briefing missing required fields", raw },
        { status: 502 },
      );
    }

    return NextResponse.json({
      briefing,
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
