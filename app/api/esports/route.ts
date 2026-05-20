import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// PandaScore free tier (~1000 req/mo). Until PANDASCORE_TOKEN is set in Vercel
// env, the route returns 503 and the panel falls back to its manual tracker.
// Sign up at https://pandascore.co/users/sign_up for a free key.
const PANDASCORE_TOKEN = process.env.PANDASCORE_TOKEN ?? "";

const GAMES: Record<string, { slug: string }> = {
  csgo: { slug: "csgo" },
  lol: { slug: "lol" },
  valorant: { slug: "valorant" },
  dota2: { slug: "dota2" },
};

type NormalizedMatch = {
  id: number;
  begin_at: string | null;
  status: string;
  bo: number;
  tournament: string;
  league: string;
  opponents: { id?: number; name: string; image?: string; acronym?: string }[];
};

type NormalizedTeam = {
  id: number;
  name: string;
  acronym?: string;
  location?: string;
  image?: string;
};

function normalizeMatches(json: any): NormalizedMatch[] {
  if (!Array.isArray(json)) return [];
  return json.map((m: any) => ({
    id: m.id,
    begin_at: m.begin_at ?? null,
    status: m.status ?? "upcoming",
    bo: m.number_of_games ?? 0,
    tournament: [m.league?.name, m.serie?.full_name].filter(Boolean).join(" — "),
    league: m.league?.name ?? "",
    opponents: (m.opponents || []).map((o: any) => ({
      id: o.opponent?.id,
      name: o.opponent?.name ?? "TBD",
      image: o.opponent?.image_url ?? undefined,
      acronym: o.opponent?.acronym ?? undefined,
    })),
  }));
}

function normalizeTeams(json: any): NormalizedTeam[] {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 10).map((t: any) => ({
    id: t.id,
    name: t.name,
    acronym: t.acronym ?? undefined,
    location: t.location ?? undefined,
    image: t.image_url ?? undefined,
  }));
}

export async function GET(req: NextRequest) {
  if (!PANDASCORE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "PANDASCORE_TOKEN not configured. Sign up free at https://pandascore.co and add the key to Vercel env.",
      },
      { status: 503 },
    );
  }

  const game = (req.nextUrl.searchParams.get("game") ?? "csgo").toLowerCase();
  const type = (req.nextUrl.searchParams.get("type") ?? "matches").toLowerCase();
  if (!GAMES[game]) {
    return NextResponse.json({ error: "Unsupported game" }, { status: 400 });
  }

  const slug = GAMES[game].slug;
  let upstream: URL;
  if (type === "matches") {
    upstream = new URL(`https://api.pandascore.co/${slug}/matches/upcoming`);
    upstream.searchParams.set("per_page", "20");
  } else if (type === "teams") {
    upstream = new URL(`https://api.pandascore.co/${slug}/teams`);
    upstream.searchParams.set("per_page", "10");
  } else {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }

  try {
    const r = await fetch(upstream.toString(), {
      headers: {
        Authorization: `Bearer ${PANDASCORE_TOKEN}`,
        Accept: "application/json",
      },
      // Cache aggressively to protect the free-tier monthly quota.
      next: { revalidate: 1800 },
    });
    const raw = await r.json().catch(() => null);
    if (!r.ok) {
      return NextResponse.json(
        { error: `PandaScore error (${r.status})`, detail: raw },
        { status: r.status },
      );
    }
    const data =
      type === "matches" ? normalizeMatches(raw) : normalizeTeams(raw);
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 },
    );
  }
}
