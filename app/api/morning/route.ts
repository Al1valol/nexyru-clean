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
  "optionsAlert": { "ticker": "TICKER", "type": "CALL or PUT", "summary": "one sentence explaining why this alert matters and what it might mean", "score": 0-100 } or null if no unusual options activity,
  "coinSnipe": { "name": "coin name", "symbol": "SYMBOL", "chain": "solana/base/etc", "summary": "one sentence on why this coin looks interesting (age, volume, buy pressure)", "score": 0-100 } or null if no prime snipes,
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
  optionsAlert: { ticker: string; type: string; summary: string; score: number } | null;
  coinSnipe: { name: string; symbol: string; chain: string; summary: string; score: number } | null;
  goals: string[];
  motivation: string;
};

// Static fallback shown when the model omits or malforms the goals array, so
// the sidebar never reads "no goals" on an otherwise successful briefing.
const FALLBACK_GOALS = [
  "Check your open crypto positions",
  "Review today's arb opportunities",
  "Log any trades from yesterday",
  "Check JARVIS hot alert section",
  "Review your book health tracker",
];

function coerceBriefing(parsed: unknown): Briefing | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const rawGoals = Array.isArray(p.goals)
    ? (p.goals as unknown[]).map((g) => String(g)).filter(Boolean)
    : [];
  const goals = rawGoals.length > 0 ? rawGoals : FALLBACK_GOALS;
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
  // Check rawGoals (pre-fallback) — otherwise the static fallback would let
  // an otherwise-empty response slip through as a valid briefing.
  if (text === 0 && rawGoals.length === 0) return null;
  const oa = p.optionsAlert;
  const optionsAlert =
    oa && typeof oa === "object" && typeof (oa as any).ticker === "string"
      ? {
          ticker: String((oa as any).ticker),
          type: String((oa as any).type || ""),
          summary: String((oa as any).summary || ""),
          score: Number((oa as any).score || 0),
        }
      : null;
  const cs = p.coinSnipe;
  const coinSnipe =
    cs && typeof cs === "object" && typeof (cs as any).name === "string"
      ? {
          name: String((cs as any).name),
          symbol: String((cs as any).symbol || ""),
          chain: String((cs as any).chain || ""),
          summary: String((cs as any).summary || ""),
          score: Number((cs as any).score || 0),
        }
      : null;
  return {
    greeting: str(p.greeting),
    overnight: str(p.overnight),
    market_overview: str(p.market_overview),
    opportunities: str(p.opportunities),
    warnings: str(p.warnings),
    hot_alert,
    optionsAlert,
    coinSnipe,
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
  const topGem = ((body as { topGem?: unknown }).topGem ?? null) as
    | { name?: string; symbol?: string; chain?: string; score?: number; snipeWindow?: { label?: string }; ageHours?: number; change1h?: number; volume?: number; liquidity?: number; buyRatio?: number }
    | null;
  const topAlert = ((body as { topAlert?: unknown }).topAlert ?? null) as
    | { ticker?: string; type?: string; score?: number; volume?: number; volumeRatio?: number; premium?: number; urgency?: string; strike?: number | string; expiry?: string; sentiment?: string }
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
${hg ? `- HOT GEM RIGHT NOW: ${hg.name} (${hg.symbol}) up ${Number(hg.change1h ?? 0).toFixed(0)}% in 1h on ${hg.chain}` : ""}

${topAlert ? `TODAY'S TOP OPTIONS ALERT:
${topAlert.ticker} ${topAlert.type} - Score ${topAlert.score}/100
Volume: ${Number(topAlert.volume ?? 0).toLocaleString()} contracts (${Number(topAlert.volumeRatio ?? 0).toFixed(1)}x normal)
Premium: $${Number(topAlert.premium ?? 0) >= 1000000 ? (Number(topAlert.premium) / 1000000).toFixed(1) + 'M' : (Number(topAlert.premium ?? 0) / 1000).toFixed(0) + 'k'}
Urgency: ${topAlert.urgency ?? 'normal'}
Strike: $${topAlert.strike} expiring ${topAlert.expiry}
Sentiment: ${topAlert.sentiment ?? 'unknown'}` : 'No unusual options activity detected today.'}

${topGem ? `TOP COIN SNIPER SIGNAL: ${topGem.name} (${topGem.symbol}) on ${topGem.chain} - Score ${topGem.score}/100 - ${topGem.snipeWindow?.label ?? ''}
- Age: ${Number(topGem.ageHours ?? 0).toFixed(1)}h, 1h change: ${Number(topGem.change1h ?? 0).toFixed(1)}%, volume 24h: $${Number(topGem.volume ?? 0).toLocaleString()}, liquidity: $${Number(topGem.liquidity ?? 0).toLocaleString()}, buy ratio: ${Math.round(Number(topGem.buyRatio ?? 0) * 100)}%` : 'No prime snipes right now.'}`;

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
      // Fallback: model occasionally wraps the JSON in prose ("Here's your
      // briefing: {...}"). Extract the first {...} block and try again.
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
      if (parsed === undefined) {
        return NextResponse.json(
          { error: "Model returned non-JSON", raw },
          { status: 502 },
        );
      }
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
