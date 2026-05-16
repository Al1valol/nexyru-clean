import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name  = String(body?.name  ?? "").trim();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const greeting = name ? `Welcome to Nexyru, ${name}! 🎉` : "Welcome to Nexyru! 🎉";

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#080808;color:#fff;">
        <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">Nexyru</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:32px;">The trading journal for funded traders</div>
        <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:12px;">${greeting}</div>
        <div style="font-size:14px;color:#9ca3af;margin-bottom:24px;line-height:1.6;">
          Your account is ready. Start by importing your trades or setting up your challenge tracker.
        </div>
        <a href="https://www.nexyru.com/dashboard" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px;">
          Go to Dashboard →
        </a>
        <div style="font-size:12px;color:#4b5563;margin-top:24px;">— The Nexyru Team</div>
      </div>
    `.trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nexyru <noreply@nexyru.com>",
        to: email,
        subject: "Welcome to Nexyru",
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
