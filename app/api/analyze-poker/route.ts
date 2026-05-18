import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

const SYSTEM = `You are an expert poker coach analyzing a hand history.

Respond with EXACTLY these section headers, each on its own line, in this order:

**1. PRE-FLOP**
**2. FLOP**
**3. TURN**
**4. RIVER**
**5. EV ANALYSIS**
**6. KEY LESSON**

Under each header, give specific feedback with numbers and ranges (e.g., "open 2.5bb", "c-bet 33% on dry boards", "this is +0.4bb vs GTO"). If a street was not played, write "Not reached." rather than omitting the header.

Be direct. No filler, no disclaimers, no preamble.`;

export async function POST(req: Request) {
  let hand: unknown;
  try {
    const body = (await req.json()) as { hand?: unknown };
    hand = body.hand;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof hand !== "string" || hand.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'hand' string" }, { status: 400 });
  }
  if (hand.length > 20_000) {
    return NextResponse.json(
      { error: "Hand history too long (max 20,000 chars)" },
      { status: 413 },
    );
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Analyze this hand history:\n\n${hand}`,
        },
      ],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      analysis: text,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${err.status}): ${err.message}` },
        { status: err.status ?? 500 },
      );
    }
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
