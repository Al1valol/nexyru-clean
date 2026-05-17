import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const USER_AGENT = "ChessCoach-Nexyru/1.0 (contact: support@nexyru.com)";

// Chess.com usernames are alphanumeric + underscore + hyphen, 3-25 chars
const USERNAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

// Only allow Chess.com archive URLs (prevents SSRF via the `url` param)
function isValidChesscomUrl(u: string): boolean {
  if (!u.startsWith("https://api.chess.com/pub/player/")) return false;
  try {
    const parsed = new URL(u);
    return parsed.host === "api.chess.com";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  const type = req.nextUrl.searchParams.get("type") ?? "profile";

  let url = "";

  if (type === "games") {
    const gamesUrl = req.nextUrl.searchParams.get("url");
    if (!gamesUrl || !isValidChesscomUrl(gamesUrl)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
    url = gamesUrl;
  } else {
    if (!username || !USERNAME_RE.test(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const u = username.toLowerCase();
    if (type === "profile") url = `https://api.chess.com/pub/player/${u}`;
    else if (type === "stats") url = `https://api.chess.com/pub/player/${u}/stats`;
    else if (type === "archives") url = `https://api.chess.com/pub/player/${u}/games/archives`;
    else return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Chess.com is a public CDN — cache lightly to avoid hammering them
      next: { revalidate: 30 },
    });

    if (res.status === 404) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Chess.com error (${res.status})` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
