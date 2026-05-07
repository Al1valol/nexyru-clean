import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side client (uses service role key so RLS doesn't block inserts)
// If you only have the anon key, use that — RLS policies from the schema
// will enforce per-user access automatically via the JWT in the auth header.
function getSupabase(authHeader: string | null) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, key, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
  return client;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const supabase   = getSupabase(authHeader);

    const body = await req.json() as {
      user_id:    string;
      status?:       string;
      monthly_price?: number;
      strategy:   {
        name:        string;
        description: string;
        rules:       Record<string, unknown>;
      };
      backtest: {
        win_rate:     number;
        return_pct:   number;
        max_drawdown: number;
        trades_count: number;
        profit_factor:number;
        equity_curve: { time: number; balance: number }[];
      };
    };

    const { user_id, strategy, backtest } = body;
    const validStatuses = ["backtested", "live", "verified"] as const;
    const status = validStatuses.includes(body.status as any)
      ? body.status as typeof validStatuses[number]
      : "backtested";

    if (!user_id || !strategy?.name || !backtest) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, strategy, backtest" },
        { status: 400 }
      );
    }

    // ── 1. Upsert strategy ────────────────────────────────────
    // Uses ON CONFLICT on (user_id, name) so re-publishing an existing
    // strategy updates it rather than creating a duplicate.
    const { data: stratRow, error: stratErr } = await supabase
      .from("strategies")
      .upsert(
        {
          user_id,
          name:        strategy.name,
          description: strategy.description ?? "",
          rules:       strategy.rules ?? {},
          status:        ["backtested","live","verified"].includes(status) ? status : "backtested",
          monthly_price: typeof body.monthly_price === "number" ? body.monthly_price : 0,
        },
        { onConflict: "user_id,name", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (stratErr) {
      console.error("[publish-strategy] strategy upsert error:", stratErr);
      return NextResponse.json({ error: stratErr.message }, { status: 500 });
    }

    const strategy_id = stratRow.id;

    // ── 2. Insert backtest result linked to strategy ──────────
    const { data: btRow, error: btErr } = await supabase
      .from("backtest_results")
      .insert({
        strategy_id,
        win_rate:     backtest.win_rate,
        return_pct:   backtest.return_pct,
        max_drawdown: backtest.max_drawdown,
        trades_count: backtest.trades_count,
        equity_curve: backtest.equity_curve ?? [],
      })
      .select("id")
      .single();

    if (btErr) {
      console.error("[publish-strategy] backtest insert error:", btErr);
      return NextResponse.json({ error: btErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok:          true,
      strategy_id,
      backtest_id: btRow.id,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[publish-strategy] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id param" }, { status: 400 });
  }

  try {
    const res = await fetch(`${url}/rest/v1/strategies?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        apikey:        key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer:        "return=minimal",
      },
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      return NextResponse.json({ error: body }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}