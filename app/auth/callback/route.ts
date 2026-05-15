import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription || errorParam)}`);
  }

  const successUrl = type === "recovery" ? `${origin}/reset-password` : `${origin}${next}`;

  const cookieStore = await cookies();
  const response = NextResponse.redirect(successUrl);

  const supabase = createServerClient(SUPA_URL, SUPA_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message || "Could not verify email")}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "invite" | "magiclink" | "email" | "email_change",
      token_hash: tokenHash,
    });
    if (!error) return response;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message || "Could not verify email")}`);
  }

  // Implicit flow (token in URL hash) — defer to client-side handler.
  const params = searchParams.toString();
  return NextResponse.redirect(`${origin}/auth/complete${params ? `?${params}` : ""}`);
}
