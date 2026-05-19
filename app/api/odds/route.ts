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
  "baseball_ncaa",
  "icehockey_nhl",
  "mma_mixed_martial_arts",
  "soccer_epl",
  "soccer_uefa_champs_league",
  "soccer_usa_mls",
  "soccer_mls",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "tennis_atp_french_open",
  "tennis_wta_french_open",
]);

function fetchSport(sport: string, daysFrom: string) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
  url.searchParams.set("apiKey", ODDS_KEY);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("daysFrom", daysFrom);
  return fetch(url.toString(), {
    headers: { Accept: "application/json" },
    // Light cache to reduce upstream calls — odds drift continuously but
    // 30s of staleness is fine for a personal dashboard.
    next: { revalidate: 30 },
  });
}

export async function GET(req: NextRequest) {
  const daysFrom = req.nextUrl.searchParams.get("daysFrom") ?? "2";
  const sportsParam = req.nextUrl.searchParams.get("sports");

  // Multi-sport mode: ?sports=baseball_mlb,basketball_nba,...
  // Fans out in parallel server-side so the client makes one request and the
  // API key never crosses the wire.
  if (sportsParam) {
    const requested = sportsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allowed = requested.filter((s) => ALLOWED_SPORTS.has(s));
    if (allowed.length === 0) {
      return NextResponse.json({ error: "No allowed sports in list" }, { status: 400 });
    }

    const results = await Promise.allSettled(allowed.map((s) => fetchSport(s, daysFrom)));
    const games: unknown[] = [];
    const skipped: string[] = [];
    let requestsRemaining: string | null = null;
    let requestsUsed: string | null = null;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sport = allowed[i];
      if (r.status !== "fulfilled" || !r.value.ok) {
        skipped.push(sport);
        continue;
      }
      const rem = r.value.headers.get("x-requests-remaining");
      const used = r.value.headers.get("x-requests-used");
      if (rem) requestsRemaining = rem;
      if (used) requestsUsed = used;
      try {
        const data = await r.value.json();
        if (Array.isArray(data)) games.push(...data);
      } catch {
        skipped.push(sport);
      }
    }

    return NextResponse.json({
      games,
      requestsRemaining,
      requestsUsed,
      sportsRequested: allowed,
      sportsSkipped: skipped,
    });
  }

  // Legacy single-sport mode.
  const sport = req.nextUrl.searchParams.get("sport") ?? "upcoming";
  if (!ALLOWED_SPORTS.has(sport)) {
    return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
  }

  try {
    const upstream = await fetchSport(sport, daysFrom);
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
