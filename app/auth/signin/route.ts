import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = "https://xsrcaceydyqytbipvrok.supabase.co";
  const redirectTo = encodeURIComponent("https://nexyru.com/dashboard");
  const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  return NextResponse.redirect(oauthUrl);
}
