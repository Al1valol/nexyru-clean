import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    // Exchange code using Supabase REST API directly
    const res = await fetch(
      `https://xsrcaceydyqytbipvrok.supabase.co/auth/v1/token?grant_type=pkce`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A",
        },
        body: JSON.stringify({ auth_code: code }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const response = NextResponse.redirect(`${origin}/dashboard`);
      response.cookies.set("sb-access-token", data.access_token, { httpOnly: true, secure: true, maxAge: 3600, path: "/" });
      response.cookies.set("sb-refresh-token", data.refresh_token, { httpOnly: true, secure: true, maxAge: 86400 * 30, path: "/" });
      return response;
    }
  }

  // Fallback - redirect to dashboard anyway and let client handle token from hash
  return NextResponse.redirect(`${origin}/dashboard`);
}
