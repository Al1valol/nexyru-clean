import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `You are a trading strategy designer. The user will describe a strategy in plain English.
Your job is to convert it into a structured strategy config.

Return ONLY valid JSON — no markdown, no explanation:

{
  "name": "Short descriptive name",
  "description": "2-3 sentence description of the strategy and when it works best",
  "entryConds": [
    { "id": "rsi_cross_up", "value": 30 }
  ],
  "exitConds": [
    { "id": "rsi_cross_down", "value": 70 }
  ],
  "slPct": 2,
  "tpPct": 5,
  "riskPct": 1
}

Available entry condition IDs (choose 1-3 that best match):
- rsi_below: RSI below a value (needs value e.g. 30)
- rsi_cross_up: RSI crosses up through a value (needs value e.g. 30)
- ema9_above_ema21: EMA 9 crosses above EMA 21 (no value needed, use null)
- macd_cross_up: MACD crosses above zero (no value needed, use null)
- price_above_sma50: Price above SMA 50 (no value needed, use null)
- price_above_sma200: Price above SMA 200 (no value needed, use null)
- breakout_high: N-bar high breakout (needs value e.g. 20)
- consecutive_green: N consecutive green bars (needs value e.g. 3)

Available exit condition IDs (choose 1-3):
- rsi_above: RSI above a value (needs value e.g. 70)
- rsi_cross_down: RSI crosses down through a value (needs value e.g. 70)
- ema9_below_ema21: EMA 9 crosses below EMA 21 (no value needed, use null)
- macd_cross_down: MACD crosses below zero (no value needed, use null)
- price_below_sma50: Price below SMA 50 (no value needed, use null)
- price_below_sma200: Price below SMA 200 (no value needed, use null)
- breakdown_low: N-bar low breakdown (needs value e.g. 20)
- consecutive_red: N consecutive red bars (needs value e.g. 3)

Rules:
- slPct: stop loss % (0.5 to 10, typical 1-3)
- tpPct: take profit % (1 to 20, typical 2x to 3x the slPct)
- riskPct: risk per trade % of account (0.5 to 5, typical 1-2)
- For conditions that don't need a value, set "value" to null
- Only use condition IDs from the lists above
- Return ONLY the JSON object`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:     SYSTEM,
        messages:   [{ role: "user", content: `Convert this strategy description: ${prompt}` }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `AI error ${res.status}: ${err}` }, { status: 502 });
    }

    const data   = await res.json();
    const raw    = data.content?.[0]?.text ?? "";
    const match  = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      return NextResponse.json({ error: "AI returned an unexpected response. Try rephrasing." }, { status: 422 });
    }

    let strategy: Record<string, unknown>;
    try { strategy = JSON.parse(match[0]); }
    catch { return NextResponse.json({ error: "Failed to parse AI response." }, { status: 422 }); }

    // Sanitise
    const validEntryIds = ["rsi_below","rsi_cross_up","ema9_above_ema21","macd_cross_up","price_above_sma50","price_above_sma200","breakout_high","consecutive_green"];
    const validExitIds  = ["rsi_above","rsi_cross_down","ema9_below_ema21","macd_cross_down","price_below_sma50","price_below_sma200","breakdown_low","consecutive_red"];

    const clamp = (v: unknown, min: number, max: number, def: number) => {
      const n = parseFloat(String(v));
      return isNaN(n) ? def : Math.min(max, Math.max(min, n));
    };

    const sanitised = {
      name:        typeof strategy.name === "string" ? strategy.name.slice(0, 60) : "AI Generated Strategy",
      description: typeof strategy.description === "string" ? strategy.description.slice(0, 300) : "",
      entryConds:  Array.isArray(strategy.entryConds)
        ? (strategy.entryConds as any[])
            .filter(c => validEntryIds.includes(c.id))
            .map(c => ({ id: c.id, value: c.value ?? null }))
        : [],
      exitConds: Array.isArray(strategy.exitConds)
        ? (strategy.exitConds as any[])
            .filter(c => validExitIds.includes(c.id))
            .map(c => ({ id: c.id, value: c.value ?? null }))
        : [],
      slPct:   clamp(strategy.slPct,   0.5, 10,  2),
      tpPct:   clamp(strategy.tpPct,   0.5, 20,  4),
      riskPct: clamp(strategy.riskPct, 0.1,  5,  1),
    };

    return NextResponse.json({ strategy: sanitised });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}