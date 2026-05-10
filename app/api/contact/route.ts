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
        to: ["calemax5@gmail.com"],
        reply_to: email,
        subject: `[Nexyru] ${topic} from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
