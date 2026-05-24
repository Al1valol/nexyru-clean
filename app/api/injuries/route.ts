import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [nbaRes, mlbRes] = await Promise.all([
      fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries", {
        cache: "no-store",
      }),
      fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries", {
        cache: "no-store",
      }),
    ]);

    const nbaData = nbaRes.ok ? await nbaRes.json() : {};
    const mlbData = mlbRes.ok ? await mlbRes.json() : {};

    const injuries: any[] = [];

    const processInjuries = (data: any, sport: string) => {
      const items = data?.items || data?.injuries || [];
      items.forEach((team: any) => {
        const teamName = team?.team?.displayName || "";
        const players = team?.injuries || [];
        players.forEach((inj: any) => {
          injuries.push({
            player: inj?.athlete?.displayName || "",
            team: teamName,
            sport,
            status: inj?.status || "",
            type: inj?.type?.description || "",
            returnDate: inj?.details?.returnDate || null,
          });
        });
      });
    };

    processInjuries(nbaData, "NBA");
    processInjuries(mlbData, "MLB");

    return NextResponse.json({ injuries });
  } catch (e: any) {
    return NextResponse.json({ injuries: [], error: e?.message });
  }
}
