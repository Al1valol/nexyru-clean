import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  pinescript: `Generate a complete Pine Script version 6 strategy for TradingView.

CRITICAL RULES for Pine Script v6 syntax:
- First line must be: //@version=6
- Use strategy("Strategy Name", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=100)
- Input functions: input.int(), input.float(), input.bool(), input.string()
- Indicators: ta.ema(), ta.sma(), ta.rsi(), ta.macd(), ta.vwap() etc
- Entry: strategy.entry("Long", strategy.long) or strategy.entry("Short", strategy.short)
- Exit: strategy.exit("Exit Long", "Long", stop=stopPrice, limit=targetPrice) or strategy.close("Long")
- Conditions use := for assignment inside if blocks
- Use var keyword for persistent variables
- All parentheses MUST be properly closed
- No syntax errors - double check every function call has opening AND closing parenthesis

Generate the complete script with proper v6 syntax, all parentheses matched, ready to paste into TradingView.`,
  ninjatrader: "Generate a complete NinjaScript strategy for NinjaTrader 8 in C#. Include proper namespace, class declaration extending Strategy, OnBarUpdate method, and all entry/exit logic. Add comments. Make it ready to compile in NinjaTrader.",
  python: "Generate a complete Python backtesting script using pandas and numpy. Include data loading placeholder, indicator calculations, signal generation based on the conditions, and basic performance metrics (win rate, total return, sharpe). Make it ready to run.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const format = String(body?.format ?? "");
    const strategy = body?.strategy ?? {};

    const instructions = FORMAT_INSTRUCTIONS[format];
    if (!instructions) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const name = typeof strategy.name === "string" ? strategy.name.slice(0, 120) : "Strategy";
    const labels = (arr: unknown) =>
      Array.isArray(arr)
        ? arr
            .map((c: any) => c?.label || c?.type || c?.id)
            .filter(Boolean)
            .join(", ")
        : "";

    const stratDesc = `
Strategy Name: ${name}
Entry Conditions: ${labels(strategy.entryConds)}
Exit Conditions: ${labels(strategy.exitConds)}
Risk per trade: ${strategy.riskPct ?? 1}%
Stop loss: ${strategy.slPct ?? 2}%
Take profit: ${strategy.tpPct ?? 4}%
`.trim();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `${instructions}\n\nStrategy details:\n${stratDesc}\n\nReturn ONLY the code, no explanation before or after.`,
        },
      ],
    });

    const first = message.content[0];
    let code = first && first.type === "text" ? first.text : "";
    if (!code) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
    }

    // Ensure version header is correct (Pine Script only)
    if (format === "pinescript" && !code.startsWith("//@version=6")) {
      code = "//@version=6\n" + code.replace(/\/\/@version=\d+\n?/, "");
    }

    return NextResponse.json({ code });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
