import { NextRequest, NextResponse } from "next/server";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription || errorParam)}`);
  }

  if (code) {
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=pkce`, {
        method: "POST",
        headers: {
          apikey: SUPA_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ auth_code: code }),
      });
      if (res.ok) {
        return NextResponse.redirect(`${origin}/auth/complete?code=${encodeURIComponent(code)}`);
      }
    } catch {}
  }

  if (tokenHash && type) {
    return NextResponse.redirect(`${origin}/auth/complete?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`);
  }

  const params = searchParams.toString();
  const redirectUrl = `${origin}/auth/complete${params ? `?${params}` : ""}`;
  return NextResponse.redirect(redirectUrl);
}
