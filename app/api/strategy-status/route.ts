import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  try {
    const { strategy_id, status } = await req.json();

    if (!strategy_id || !status) {
      return NextResponse.json({ error: "Missing strategy_id or status" }, { status: 400 });
    }

    if (!["backtested", "live", "verified"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const res = await fetch(
      `${url}/rest/v1/strategies?id=eq.${strategy_id}`,
      {
        method: "PATCH",
        headers: {
          apikey:          key,
          Authorization:   `Bearer ${key}`,
          "Content-Type":  "application/json",
          Prefer:          "return=representation",
        },
        body: JSON.stringify({ status }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: JSON.stringify(data) }, { status: res.status });
    }

    return NextResponse.json({ ok: true, strategy: data[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
