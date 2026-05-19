import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// balldontlie now requires an API key on all v1 endpoints (transition happened
// in 2024). Keep the key server-side and proxy from the client. Free tier is
// fine for low-volume dashboard use; sign up at balldontlie.io/account.
const BALLDONTLIE_KEY = process.env.BALLDONTLIE_KEY ?? "";

// Allowlist of upstream paths the client can hit through this proxy. Keeps the
// route from becoming a generic open relay against balldontlie.io.
const ALLOWED_PATHS = new Set(["players", "season_averages", "teams", "stats"]);

export async function GET(req: NextRequest) {
  if (!BALLDONTLIE_KEY) {
    return NextResponse.json(
      { error: "BALLDONTLIE_KEY not configured on server" },
      { status: 500 },
    );
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path || !ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ error: "Unsupported path" }, { status: 400 });
  }

  // Forward every query param except `path` itself. Preserves repeated keys
  // like `player_ids[]=1&player_ids[]=2` that balldontlie's batch endpoints
  // require.
  const upstream = new URL(`https://api.balldontlie.io/v1/${path}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key === "path") return;
    upstream.searchParams.append(key, value);
  });

  try {
    const r = await fetch(upstream.toString(), {
      headers: { Authorization: BALLDONTLIE_KEY, Accept: "application/json" },
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 },
    );
  }
}
