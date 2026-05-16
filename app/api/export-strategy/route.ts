import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  pinescript: "Generate a complete Pine Script version 6 strategy script for TradingView. Start with //@version=6 and use strategy() declaration. Use Pine Script v6 syntax - note that v6 uses var keyword differently, input() functions have changed to input.int(), input.float(), input.bool() etc. Include all indicators, entry conditions with strategy.entry(), exit conditions with strategy.exit() or strategy.close(). Add clear comments explaining each section. Make it syntactically correct and ready to paste directly into TradingView Pine Script editor.",
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
    const code = first && first.type === "text" ? first.text : "";
    if (!code) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
    }

    return NextResponse.json({ code });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
