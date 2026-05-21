import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// The Odds API key — env wins, hardcoded fallback matches the existing /api/odds.
const ODDS_KEY =
  process.env.ODDS_API_KEY ?? "21dc56ed56eb5bf7ddfbb44ba8de79c3";

// Player-prop markets require the PER-EVENT endpoint
// (/sports/{sport}/events/{event_id}/odds), not the bulk /odds path — that one
// 422s with "Markets not supported by this endpoint".
const MARKET_LABELS: Record<string, string> = {
  // NBA
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes: "3-Pointers",
  player_points_rebounds_assists: "PRA",
  // MLB
  batter_hits: "Hits",
  batter_home_runs: "Home Runs",
  batter_rbis: "RBIs",
  batter_runs_scored: "Runs",
  batter_total_bases: "Total Bases",
  pitcher_strikeouts: "Strikeouts",
  pitcher_record_a_win: "Pitcher Win",
};

const ALLOWED_MARKETS = new Set(Object.keys(MARKET_LABELS));

// Cap events fetched per call to protect The Odds API quota. NBA usually has
// 2-12 games/day, MLB up to 16-18 — at 1 request per event the daily volume
// adds up fast on the 500/mo plan.
const MAX_EVENTS_PER_REQUEST = 12;

type Prop = {
  player: string;
  game: string;
  gameId: string;
  commenceTime: string;
  market: string;
  marketLabel: string;
  line: number;
  overOdds: number | null;
  overBook: string | null;
  underOdds: number | null;
  underBook: string | null;
};

function americanToDecimal(o: number): number {
  return o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1;
}

// "Better" American odds for the bettor = higher decimal payout. e.g.
// +120 beats -110 beats -130.
function isBetter(a: number, b: number): boolean {
  return americanToDecimal(a) > americanToDecimal(b);
}

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get("sport") ?? "basketball_nba";
  const marketsParam =
    req.nextUrl.searchParams.get("markets") ??
    "player_points,player_rebounds,player_assists";
  const requestedMarkets = marketsParam
    .split(",")
    .map((m) => m.trim())
    .filter((m) => ALLOWED_MARKETS.has(m));
  if (requestedMarkets.length === 0) {
    return NextResponse.json({ error: "No supported markets" }, { status: 400 });
  }
  const markets = requestedMarkets.join(",");

  try {
    // Step 1: list upcoming events for the sport. Cheap — 1 request, cached 10m.
    const evRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${ODDS_KEY}`,
      { next: { revalidate: 600 } },
    );
    if (!evRes.ok) {
      const text = await evRes.text();
      return NextResponse.json(
        { error: `Events fetch error (${evRes.status})`, detail: text.slice(0, 240) },
        { status: evRes.status },
      );
    }
    const allEvents: any[] = await evRes.json();
    if (!Array.isArray(allEvents) || allEvents.length === 0) {
      return NextResponse.json({ data: [], total: 0, events: 0 });
    }
    // Trim to MAX_EVENTS_PER_REQUEST (earliest-first since the list is
    // ordered by commence_time ascending).
    const events = allEvents.slice(0, MAX_EVENTS_PER_REQUEST);

    // Step 2: fetch per-event props in parallel. One request per event,
    // regardless of how many markets are bundled in the query.
    const results = await Promise.allSettled(
      events.map((e: any) =>
        fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/events/${e.id}/odds?apiKey=${ODDS_KEY}&regions=us&markets=${markets}&oddsFormat=american`,
          { next: { revalidate: 600 } },
        ).then((r) => (r.ok ? r.json() : null)),
      ),
    );

    // Step 3: aggregate — for each (event, player, market, line) combination,
    // keep the best Over price and best Under price across all books.
    const propMap = new Map<string, Prop>();
    let requestsRemaining: string | null = evRes.headers.get("x-requests-remaining");

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const ev = events[i];
      if (r.status !== "fulfilled" || !r.value) continue;
      const data = r.value as any;
      for (const bk of data.bookmakers || []) {
        for (const market of bk.markets || []) {
          const marketKey = market.key;
          if (!ALLOWED_MARKETS.has(marketKey)) continue;
          const marketLabel = MARKET_LABELS[marketKey] ?? marketKey;
          for (const o of market.outcomes || []) {
            const player: string | undefined = o.description;
            const line: number | undefined = o.point;
            const side: string | undefined = o.name;
            const price: number | undefined = o.price;
            if (!player || typeof line !== "number" || typeof price !== "number") continue;
            const key = `${ev.id}|${marketKey}|${player}|${line}`;
            let prop = propMap.get(key);
            if (!prop) {
              prop = {
                player,
                game: `${ev.away_team} vs ${ev.home_team}`,
                gameId: ev.id,
                commenceTime: ev.commence_time,
                market: marketKey,
                marketLabel,
                line,
                overOdds: null,
                overBook: null,
                underOdds: null,
                underBook: null,
              };
              propMap.set(key, prop);
            }
            if (side === "Over") {
              if (prop.overOdds === null || isBetter(price, prop.overOdds)) {
                prop.overOdds = price;
                prop.overBook = bk.title;
              }
            } else if (side === "Under") {
              if (prop.underOdds === null || isBetter(price, prop.underOdds)) {
                prop.underOdds = price;
                prop.underBook = bk.title;
              }
            }
          }
        }
      }
    }

    const data = Array.from(propMap.values()).sort((a, b) =>
      a.player.localeCompare(b.player),
    );
    return NextResponse.json({
      data,
      total: data.length,
      events: events.length,
      requestsRemaining,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 },
    );
  }
}
