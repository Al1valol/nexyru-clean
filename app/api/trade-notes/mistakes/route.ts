import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase.from("mistakes").select("*").limit(50);
    if (error) return NextResponse.json({ mistakes: [] });
    return NextResponse.json({ mistakes: data ?? [] });
  } catch {
    return NextResponse.json({ mistakes: [] });
  }
}
