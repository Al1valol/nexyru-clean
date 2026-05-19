import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Prefer BALLDONTLIE_KEY env var; fall back to a hardcoded constant so the
// route works without env configuration. Rotate via Vercel env without
// touching code.
const BDL_KEY =
  process.env.BALLDONTLIE_KEY ?? "b9b04dc4-1b1e-4002-b759-f5acc68be74d";

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get("sport") ?? "nba";
  const search = req.nextUrl.searchParams.get("search") ?? "james";
  const ids = req.nextUrl.searchParams.get("ids") ?? "";

  try {
    if (sport === "nba") {
      if (ids) {
        // Numeric-id allowlist: drop anything that isn't a positive integer so
        // the upstream call can't be poisoned with arbitrary text.
        const numeric = ids
          .split(",")
          .map((v) => v.trim())
          .filter((v) => /^\d+$/.test(v));
        if (numeric.length === 0) {
          return NextResponse.json({ data: [] });
        }
        const upstream = new URL("https://api.balldontlie.io/v1/season_averages");
        upstream.searchParams.set("season", "2024");
        numeric.forEach((id) => upstream.searchParams.append("player_ids[]", id));
        const r = await fetch(upstream.toString(), {
          headers: { Authorization: BDL_KEY, Accept: "application/json" },
          next: { revalidate: 60 },
        });
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          return NextResponse.json(
            { error: `balldontlie error (${r.status})`, detail: data },
            { status: r.status },
          );
        }
        return NextResponse.json(data);
      }

      const upstream = new URL("https://api.balldontlie.io/v1/players");
      upstream.searchParams.set("per_page", "25");
      upstream.searchParams.set("search", search);
      const r = await fetch(upstream.toString(), {
        headers: { Authorization: BDL_KEY, Accept: "application/json" },
        next: { revalidate: 60 },
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return NextResponse.json(
          { error: `balldontlie error (${r.status})`, detail: data },
          { status: r.status },
        );
      }
      return NextResponse.json(data);
    }

    if (sport === "mlb") {
      const upstream = new URL("https://statsapi.mlb.com/api/v1/stats");
      upstream.searchParams.set("stats", "season");
      upstream.searchParams.set("season", "2025");
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
