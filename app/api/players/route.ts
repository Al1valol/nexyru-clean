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
      // Fetch HR leaders AND AVG leaders in parallel, dedupe, return a flat
      // {players:[…]} shape. Catches both power hitters (high HR / low AVG)
      // and contact hitters (high AVG / low HR) that a single sort would miss.
      const mkUrl = (sortStat: string) => {
        const u = new URL("https://statsapi.mlb.com/api/v1/stats");
        u.searchParams.set("stats", "season");
        u.searchParams.set("season", MLB_SEASON);
        u.searchParams.set("group", "hitting");
        u.searchParams.set("gameType", "R");
        u.searchParams.set("limit", "25");
        u.searchParams.set("sortStat", sortStat);
        u.searchParams.set("order", "desc");
        u.searchParams.set("playerPool", "ALL");
        return u.toString();
      };
      try {
        const [hrRes, avgRes] = await Promise.all([
          fetch(mkUrl("homeRuns"), { headers: { Accept: "application/json" }, next: { revalidate: 300 } }),
          fetch(mkUrl("battingAverage"), { headers: { Accept: "application/json" }, next: { revalidate: 300 } }),
        ]);
        const hrData = await hrRes.json().catch(() => null);
        const avgData = await avgRes.json().catch(() => null);
        const hrSplits = hrData?.stats?.[0]?.splits ?? [];
        const avgSplits = avgData?.stats?.[0]?.splits ?? [];
        const seen = new Set<number>();
        const combined = [...hrSplits, ...avgSplits].filter((s: any) => {
          const id = s.player?.id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const players = combined
          .map((s: any) => ({
            id: s.player?.id,
            name: s.player?.fullName,
            team: s.team?.name || s.team?.abbreviation || "N/A",
            avg: s.stat?.avg || ".000",
            homeRuns: s.stat?.homeRuns ?? 0,
            rbi: s.stat?.rbi ?? 0,
            hits: s.stat?.hits ?? 0,
            ops: s.stat?.ops || ".000",
            atBats: s.stat?.atBats ?? 0,
            runs: s.stat?.runs ?? 0,
            strikeouts: s.stat?.strikeOuts ?? 0,
            gamesPlayed: s.stat?.gamesPlayed ?? 0,
          }))
          .filter((p: any) => p.name)
          .sort((a: any, b: any) => (b.homeRuns ?? 0) - (a.homeRuns ?? 0));
        return NextResponse.json({ players });
      } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Fetch failed", players: [] });
      }
    }

    if (sport === "nhl") {
      // NHL stats API is public — no key needed. Returns leaders by category.
      const r = await fetch(
        "https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=goals,assists,points&limit=50",
        { next: { revalidate: 1800 } },
      ).catch(() => null);
      const data = r && r.ok ? await r.json().catch(() => null) : null;
      const goals = data?.goals ?? [];
      const assists = data?.assists ?? [];
      const points = data?.points ?? [];
      const allProps: any[] = [];
      const pushNhl = (list: any[], prop: string, line: number) => {
        list.forEach((player: any) => {
          const games = player.gamesPlayed || 82;
          const total = player.value || 0;
          const perGame = total / games;
          const edge = line > 0 ? ((perGame - line) / line) * 100 : 0;
          allProps.push({
            player: `${player.firstName?.default ?? ""} ${player.lastName?.default ?? ""}`.trim(),
            team: player.teamAbbrev?.default || "",
            sport: "NHL",
            prop,
            seasonAvg: parseFloat(perGame.toFixed(2)),
            line,
            edge,
            pick: perGame > line ? "OVER" : "UNDER",
            score: Math.round(Math.abs(perGame - line) * 100),
            confidence: perGame > line * 1.4 ? "Strong" : "Good",
            gamesPlayed: games,
            lastFive: [],
          });
        });
      };
      pushNhl(goals, "Goals", 0.5);
      pushNhl(assists, "Assists", 0.5);
      pushNhl(points, "Points", 1.5);
      return NextResponse.json({ allProps });
    }

    if (sport === "nfl") {
      // ESPN's free stats endpoint — leaders by category.
      const r = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics?limit=50",
        { next: { revalidate: 1800 } },
      ).catch(() => null);
      const data = r && r.ok ? await r.json().catch(() => null) : null;
      const categories: any[] = data?.results?.stats?.categories || data?.categories || [];
      const allProps: any[] = [];
      categories.forEach((cat: any) => {
        const label = cat?.displayName || cat?.name || "";
        const leaders: any[] = cat?.leaders || cat?.athletes || [];
        leaders.slice(0, 25).forEach((entry: any) => {
          const ath = entry?.athlete || entry;
          const value = parseFloat(entry?.value || entry?.displayValue || "0") || 0;
          const games = 17;
          const perGame = value / games;
          let line = 0;
          let propName = label;
          if (/passing yards/i.test(label)) { line = 240.5; propName = "Passing Yards"; }
          else if (/rushing yards/i.test(label)) { line = 60.5; propName = "Rushing Yards"; }
          else if (/receiving yards/i.test(label)) { line = 50.5; propName = "Receiving Yards"; }
          else if (/touchdowns/i.test(label)) { line = 0.5; propName = "Touchdowns"; }
          else return;
          const edge = line > 0 ? ((perGame - line) / line) * 100 : 0;
          allProps.push({
            player: ath?.displayName || ath?.name || "",
            team: ath?.team?.abbreviation || ath?.teamAbbreviation || "",
            sport: "NFL",
            prop: propName,
            seasonAvg: parseFloat(perGame.toFixed(2)),
            line,
            edge,
            pick: perGame > line ? "OVER" : "UNDER",
            score: Math.round(Math.min(100, Math.abs(edge))),
            confidence: Math.abs(edge) > 15 ? "Strong" : "Good",
            gamesPlayed: games,
            lastFive: [],
          });
        });
      });
      return NextResponse.json({ allProps });
    }

    return NextResponse.json({ data: [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 },
    );
  }
}
