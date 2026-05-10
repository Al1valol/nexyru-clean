"use client";
import { useState } from "react";

const TOPICS = [
  { icon:"📧", label:"General",  subject:"General Question",  desc:"hello@nexyru.com" },
  { icon:"🐛", label:"Bug Report", subject:"Bug Report",      desc:"hello@nexyru.com" },
  { icon:"💡", label:"Feature",  subject:"Feature Request",   desc:"hello@nexyru.com" },
  { icon:"🔒", label:"Privacy",  subject:"Privacy Question",  desc:"hello@nexyru.com" },
];

export default function Contact() {
  const [sent,    setSent]    = useState(false);
  const [topic,   setTopic]   = useState(TOPICS[0]);
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    const mailto = `mailto:founder@nexyru.com?subject=${encodeURIComponent(`[${topic.subject}] from ${name}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`;
    window.location.href = mailto;
    setTimeout(() => setSent(true), 500);
  };

  const ready = name && email && message;

  return (
    <div style={{background:"#060d1a",minHeight:"100vh",fontFamily:"system-ui,sans-serif",padding:"80px 20px",display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
      <div style={{maxWidth:580,width:"100%"}}>
        <a href="/" style={{fontSize:13,color:"#38bdf8",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,marginBottom:40}}>← Back to Nexyru</a>
        <h1 style={{fontSize:36,fontWeight:900,color:"#f0f4ff",marginBottom:8,letterSpacing:"-0.02em"}}>Contact Us</h1>
        <p style={{fontSize:15,color:"#475569",marginBottom:40,lineHeight:1.7}}>We read every message and respond within 24 hours.</p>

        {sent ? (
          <div style={{padding:"40px",borderRadius:20,background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16}}>✅</div>
            <div style={{fontSize:18,fontWeight:800,color:"#34d399",marginBottom:8}}>Message sent!</div>
            <div style={{fontSize:14,color:"#475569"}}>We'll get back to you at <strong style={{color:"#e2e8f0"}}>{email}</strong> within 24 hours.</div>
          </div>
        ) : (
          <div style={{background:"linear-gradient(135deg,#0d1628,#0f1e30)",border:"1px solid #1a2540",borderRadius:20,padding:"28px"}}>

            {/* Topic selector */}
            <div style={{marginBottom:20}}>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:10,letterSpacing:"0.06em",textTransform:"uppercase"}}>What's this about?</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {TOPICS.map(t => (
                  <button key={t.label} onClick={() => setTopic(t)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:`1.5px solid ${topic.label===t.label?"rgba(56,189,248,0.4)":"#1a2540"}`,background:topic.label===t.label?"rgba(56,189,248,0.08)":"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"left",outline:"none"}}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{fontSize:13,fontWeight:topic.label===t.label?700:500,color:topic.label===t.label?"#38bdf8":"#64748b"}}>{t.label}</span>
                    {topic.label===t.label && <span style={{marginLeft:"auto",fontSize:10,color:"#38bdf8"}}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[{label:"Name",value:name,set:setName,type:"text",placeholder:"Your name"},{label:"Email",value:email,set:setEmail,type:"email",placeholder:"your@email.com"}].map(f => (
                <div key={f.label}>
                  <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #1a2540",background:"#0b1120",color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>Message</label>
                <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell us what's on your mind…" rows={5} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #1a2540",background:"#0b1120",color:"#e2e8f0",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"system-ui"}}/>
              </div>
              <button onClick={handleSend} disabled={!ready} style={{padding:"12px",borderRadius:12,border:"none",background:ready?"linear-gradient(135deg,#0369a1,#38bdf8)":"#1a2540",color:ready?"#fff":"#334155",fontSize:14,fontWeight:700,cursor:ready?"pointer":"not-allowed"}}>
                Send Message →
              </button>
              <div style={{fontSize:11,color:"#334155",textAlign:"center"}}>Sends to founder@nexyru.com · We reply within 24 hours</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
