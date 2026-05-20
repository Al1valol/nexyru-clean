import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// PandaScore free tier (~1000 req/mo). Prefer PANDASCORE_TOKEN env var; fall
// back to a hardcoded constant so the route works without env configuration.
// Rotate via Vercel env without touching code.
const PANDASCORE_TOKEN =
  process.env.PANDASCORE_TOKEN ??
  "ihtscxHiWnvHYdS1lQkJwRyU6vv2vUO7GwYLvdfkH0mdcsRkpMc";

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

type NormalizedPlayer = {
  id: number;
  name: string;
  fullName?: string;
  role?: string;
  nationality?: string;
  image?: string;
  team?: string;
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
      // PandaScore sometimes returns a ranking on the opponent (esp. for
      // ranked CS/LoL teams). Pass it through when present so the client
      // can do rank-based verdicts; null when PandaScore omits it.
      ranking:
        typeof o.opponent?.current_videogame?.ranking === "number"
          ? o.opponent.current_videogame.ranking
          : typeof o.opponent?.ranking === "number"
            ? o.opponent.ranking
            : null,
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

function normalizePlayers(json: any): NormalizedPlayer[] {
  if (!Array.isArray(json)) return [];
  return json.map((p: any) => ({
    id: p.id,
    name: p.name ?? "Unknown",
    fullName: [p.first_name, p.last_name].filter(Boolean).join(" ") || undefined,
    role: p.role ?? undefined,
    nationality: p.nationality ?? undefined,
    image: p.image_url ?? undefined,
    team: p.current_team?.name ?? undefined,
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
    upstream.searchParams.set("sort", "begin_at");
  } else if (type === "live") {
    upstream = new URL(`https://api.pandascore.co/${slug}/matches/running`);
    upstream.searchParams.set("per_page", "10");
  } else if (type === "teams") {
    upstream = new URL(`https://api.pandascore.co/${slug}/teams`);
    upstream.searchParams.set("per_page", "10");
  } else if (type === "players") {
    upstream = new URL(`https://api.pandascore.co/${slug}/players`);
    upstream.searchParams.set("per_page", "20");
    upstream.searchParams.set("sort", "-modified_at");
  } else {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }

  try {
    const r = await fetch(upstream.toString(), {
      headers: {
        Authorization: `Bearer ${PANDASCORE_TOKEN}`,
        Accept: "application/json",
      },
      // Live matches change state quickly (could end any minute); upcoming
      // and teams are stable, so cache them aggressively to protect quota.
      next: { revalidate: type === "live" ? 60 : 1800 },
    });
    const raw = await r.json().catch(() => null);
    if (!r.ok) {
      return NextResponse.json(
        { error: `PandaScore error (${r.status})`, detail: raw },
        { status: r.status },
      );
    }
    // Dispatch to the right normalizer per type. /matches/running and
    // /matches/upcoming share normalizeMatches.
    const data =
      type === "teams" ? normalizeTeams(raw)
      : type === "players" ? normalizePlayers(raw)
      : normalizeMatches(raw);
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 },
    );
  }
}
