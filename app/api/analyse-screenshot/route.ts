import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `You are a trading journal assistant. The user will send you a screenshot from a trading platform — TradingView, MetaTrader, a broker app, or a trade history list.

The screenshot may show ONE trade or MULTIPLE trades (e.g. a trade history table with many rows).

Extract ALL visible trades. Return ONLY a valid JSON array — no other text, no markdown:

[
  {
    "pair": "BTC/USD",
    "type": "long",
    "entryPrice": 96500,
    "exitPrice": 98200,
    "stopLoss": 95000,
    "takeProfit": 99000,
    "size": 1,
    "pnl": 1700,
    "pnlPercent": 1.76,
    "strategy": "Breakout",
    "notes": "Clean breakout above resistance",
    "tradeDate": "2024-11-15T14:30:00",
    "dateFromImage": true,
    "confidence": "HIGH"
  }
]

Rules:
- Always return an array, even if only one trade is visible
- type must be "long" or "short"
- All prices must be numbers, not strings
- Use null for any field not visible in the screenshot
- pair format: "BTC/USD" not "BTCUSDT"
- notes: briefly describe what you see
- tradeDate: if a date/time is visible in the screenshot, include it as ISO 8601 string. If no date is visible, set tradeDate to null and dateFromImage to false
- dateFromImage: true if you found a real date in the image, false if not
- confidence: "HIGH" if the symbol, direction, entry and exit are all clearly visible; "MEDIUM" if any of those required values had to be inferred; "LOW" if the image is ambiguous, partially obscured, or you had to guess significantly
- Return ONLY the JSON array, nothing else`;

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType } = await req.json();
    if (!base64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured in .env.local" }, { status: 500 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType ?? "image/png", data: base64 } },
            { type: "text", text: "Extract all trades from this screenshot and return the JSON array." }
          ]
        }]
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", res.status, err);
      return NextResponse.json({ error: `AI request failed (${res.status}).` }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { return NextResponse.json({ trades: [sanitise(JSON.parse(objMatch[0]))] }); } catch {}
      }
      return NextResponse.json({ error: "No trade data found in this screenshot." }, { status: 422 });
    }

    let raw_trades: unknown[];
    try { raw_trades = JSON.parse(jsonMatch[0]); }
    catch { return NextResponse.json({ error: "AI returned malformed data." }, { status: 422 }); }

    if (!Array.isArray(raw_trades) || !raw_trades.length) {
      return NextResponse.json({ error: "No trades could be extracted." }, { status: 422 });
    }

    return NextResponse.json({ trades: raw_trades.map(t => sanitise(t as Record<string, unknown>)) });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function sanitise(trade: Record<string, unknown>) {
  const num = (v: unknown) => typeof v === "number" ? v : parseFloat(String(v ?? "")) || null;

  // Parse date from image if present
  const dateFromImage = trade.dateFromImage === true;
  const tradeDateStr  = typeof trade.tradeDate === "string" ? trade.tradeDate : null;
  const parsedDate    = tradeDateStr ? new Date(tradeDateStr).getTime() : null;
  const date          = parsedDate && !isNaN(parsedDate) ? parsedDate : Date.now();

  return {
    pair:            typeof trade.pair === "string" ? trade.pair : null,
    type:            trade.type === "short" ? "short" : "long",
    entryPrice:      num(trade.entryPrice),
    exitPrice:       num(trade.exitPrice),
    stopLoss:        num(trade.stopLoss),
    takeProfit:      num(trade.takeProfit),
    size:            num(trade.size) ?? 1,
    pnl:             num(trade.pnl) ?? 0,
    pnlPercent:      num(trade.pnlPercent) ?? 0,
    strategy:        typeof trade.strategy === "string" ? trade.strategy : "Screenshot Import",
    notes:           typeof trade.notes === "string" ? trade.notes : "",
    date,
    _dateFromImage:  dateFromImage,
    confidence:      trade.confidence === "HIGH" || trade.confidence === "MEDIUM" || trade.confidence === "LOW" ? trade.confidence : "MEDIUM",
  };
}