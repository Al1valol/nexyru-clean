import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { origin, hash, searchParams } = new URL(request.url);
  
  // Build the redirect URL preserving any query params
  const params = searchParams.toString();
  const redirectUrl = `${origin}/auth/complete${params ? `?${params}` : ""}`;
  
  return NextResponse.redirect(redirectUrl);
}
