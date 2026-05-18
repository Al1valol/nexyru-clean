import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// the-odds-api key. Prefer ODDS_API_KEY env var; fall back to a hardcoded
// constant so the route still works without env configuration. Either way
// the key stays on the server and is never shipped in the client bundle.
const ODDS_KEY = process.env.ODDS_API_KEY ?? "4d2ef024779232aa1d00e6089e6156c8";

const ALLOWED_SPORTS = new Set([
  "upcoming",
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "icehockey_nhl",
  "mma_mixed_martial_arts",
  "soccer_epl",
  "soccer_uefa_champs_league",
  "soccer_usa_mls",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
]);

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get("sport") ?? "upcoming";
  if (!ALLOWED_SPORTS.has(sport)) {
    return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
  }

  const daysFrom = req.nextUrl.searchParams.get("daysFrom") ?? "2";
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
  url.searchParams.set("apiKey", ODDS_KEY);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("daysFrom", daysFrom);

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      // Light cache to reduce upstream calls — odds drift continuously but
      // 30s of staleness is fine for a personal dashboard.
      next: { revalidate: 30 },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        { error: `Odds API error (${upstream.status})`, detail: text.slice(0, 240) },
        { status: upstream.status },
      );
    }

    const remaining = upstream.headers.get("x-requests-remaining");
    const used = upstream.headers.get("x-requests-used");
    const data = await upstream.json();

    return NextResponse.json(
      { games: data, requestsRemaining: remaining, requestsUsed: used },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
