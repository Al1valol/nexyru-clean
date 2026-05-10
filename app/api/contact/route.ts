import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, message, topic } = await req.json();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nexyru <onboarding@resend.dev>",
        to: ["founder@nexyru.com"],
        reply_to: email,
        subject: `[Nexyru] ${topic} from ${name}`,
        text: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}`,
      }),
    });

    const data = await res.json();
    console.log("Resend response:", res.status, JSON.stringify(data));

    if (!res.ok) return NextResponse.json({ error: data }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Contact error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
