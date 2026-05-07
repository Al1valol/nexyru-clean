import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "backtested";

  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const endpoint = `${url}/rest/v1/strategies?status=eq.${status}&select=id,user_id,name,description,rules,created_at,status,backtest_results(id,win_rate,return_pct,max_drawdown,trades_count,equity_curve,created_at)`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey:         key,
        Authorization:  `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: JSON.stringify(data) }, { status: res.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
