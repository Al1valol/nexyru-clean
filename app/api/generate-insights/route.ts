import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `You are an expert trading coach analyzing a trader's journal data.
You will receive a structured summary of their trading performance.
Write a concise, personal, actionable coaching summary in 3-4 short paragraphs.
Be specific — use the actual numbers and strategy names from the data.
Be honest — if they're losing, say so clearly and explain why.
Don't use bullet points. Write in a natural, direct coaching voice.
End with one specific, concrete action they should take this week.
Keep total response under 200 words.`;

export async function POST(req: NextRequest) {
  try {
    const { summary } = await req.json();
    if (!summary) return NextResponse.json({ error: "No summary provided" }, { status: 400 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey    = process.env.OPENAI_API_KEY;

    if (!anthropicKey && !openaiKey) {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    const userMsg = `Here is my trading journal summary:
- Total trades: ${summary.totalTrades}
- Win rate: ${summary.winRate}%
- Total PnL: ${summary.totalPnl}
- Top insights found: ${summary.topInsights?.join("; ")}
- Best strategies: ${JSON.stringify(summary.strategies?.slice(0, 2))}
- Tag analysis: ${JSON.stringify(summary.tags?.slice(0, 2))}
- Long trades: ${summary.direction?.long?.count} trades, ${summary.direction?.long?.winRate}% WR
- Short trades: ${summary.direction?.short?.count} trades, ${summary.direction?.short?.winRate}% WR

Please give me your honest coaching assessment.`;

    let text = "";

    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 400,
          system: SYSTEM,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Anthropic error:", err);
        return NextResponse.json({ error: "AI request failed" }, { status: 502 });
      }
      const data = await res.json();
      text = data.content?.[0]?.text ?? "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
        }),
      });
      if (!res.ok) return NextResponse.json({ error: "AI request failed" }, { status: 502 });
      const data = await res.json();
      text = data.choices?.[0]?.message?.content ?? "";
    }

    if (!text) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    return NextResponse.json({ insight: text });

  } catch (err: any) {
    console.error("generate-insights error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 