import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  // Token is in hash fragment - redirect to dashboard and let client JS handle it
  return NextResponse.redirect(`${origin}/dashboard`);
}
