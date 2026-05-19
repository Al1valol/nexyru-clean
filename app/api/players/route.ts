import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// NBA season leader stats come from stats.nba.com. It's the official feed but
// blocks default User-Agents — must look like a browser request from nba.com
// or it 403s. No API key required.
const NBA_SEASON = "2025-26";

// Latest finished MLB regular season.
const MLB_SEASON = "2025";

type NbaPlayer = {
  id: number;
  name: string;
  team: string;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  fg_pct: number;
};

// Convert stats.nba.com's columnar { headers, rowSet } into flat objects so
// the client doesn't need to know about the column order.
function transformNbaLeaders(json: any): NbaPlayer[] {
  const rs = json?.resultSet;
  if (!rs?.headers || !Array.isArray(rs.rowSet)) return [];
  const idx: Record<string, number> = {};
  rs.headers.forEach((h: string, i: number) => (idx[h] = i));
  return rs.rowSet.map((row: any[]) => ({
    id: Number(row[idx.PLAYER_ID]) || 0,
    name: String(row[idx.PLAYER] ?? "Unknown"),
    team: String(row[idx.TEAM] ?? ""),
    gp: Number(row[idx.GP]) || 0,
    mpg: Number(row[idx.MIN]) || 0,
    ppg: Number(row[idx.PTS]) || 0,
    rpg: Number(row[idx.REB]) || 0,
    apg: Number(row[idx.AST]) || 0,
    fg_pct: Number(row[idx.FG_PCT]) || 0,
  }));
}

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get("sport") ?? "nba";
  const search = (req.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();

  try {
    if (sport === "nba") {
      const upstream = new URL("https://stats.nba.com/stats/leagueLeaders");
      upstream.searchParams.set("LeagueID", "00");
      upstream.searchParams.set("PerMode", "PerGame");
      upstream.searchParams.set("Scope", "S");
      upstream.searchParams.set("Season", NBA_SEASON);
      upstream.searchParams.set("SeasonType", "Regular Season");
      upstream.searchParams.set("StatCategory", "PTS");

      const r = await fetch(upstream.toString(), {
        headers: {
          // stats.nba.com 403s on non-browser User-Agents.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Referer: "https://www.nba.com/",
          Accept: "application/json",
        },
        // Leaderboard refreshes daily; cache for half an hour.
        next: { revalidate: 1800 },
      });
      const raw = await r.json().catch(() => null);
      if (!r.ok || !raw) {
        return NextResponse.json(
          { error: `NBA stats error (${r.status})`, detail: raw },
          { status: r.status || 502 },
        );
      }
      const players = transformNbaLeaders(raw);
      const filtered = search
        ? players.filter((p) => p.name.toLowerCase().includes(search))
        : players;
      return NextResponse.json({ data: filtered, season: NBA_SEASON, total: players.length });
    }

    if (sport === "mlb") {
      const upstream = new URL("https://statsapi.mlb.com/api/v1/stats");
      upstream.searchParams.set("stats", "season");
      upstream.searchParams.set("season", MLB_SEASON);
      upstream.searchParams.set("group", "hitting");
      upstream.searchParams.set("gameType", "R");
      upstream.searchParams.set("limit", "50");
      upstream.searchParams.set("offset", "0");
      upstream.searchParams.set("sortStat", "battingAverage");
      upstream.searchParams.set("order", "desc");
      const r = await fetch(upstream.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return NextResponse.json(
          { error: `MLB stats error (${r.status})`, detail: data },
          { status: r.status },
        );
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ data: [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 },
    );
  }
}
