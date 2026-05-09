import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  // Redirect to a client page that can read the hash fragment
  return NextResponse.redirect(`${origin}/auth/complete`);
}
