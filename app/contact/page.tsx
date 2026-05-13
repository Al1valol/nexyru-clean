"use client";
import { useState } from "react";
const TOPICS=[{icon:"",label:"General",subject:"General Question"},{icon:"",label:"Bug Report",subject:"Bug Report"},{icon:"",label:"Feature",subject:"Feature Request"},{icon:"",label:"Privacy",subject:"Privacy Question"}];
export default function Contact(){
  const[sent,setSent]=useState(false);
  const[topic,setTopic]=useState(TOPICS[0]);
  const[name,setName]=useState("");
  const[email,setEmail]=useState("");
  const[message,setMessage]=useState("");
  const[sending,setSending]=useState(false);
  const[error,setError]=useState("");
  const ready=name&&email&&message;
  const handleSend=async()=>{
    setSending(true);setError("");
    try{
      const res=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,message,topic:topic.subject})});
      if(res.ok)setSent(true);
      else setError("Something went wrong. Email founder@nexyru.com directly.");
    }catch{setError("Something went wrong. Email founder@nexyru.com directly.");}
    setSending(false);
  };
  return(
    <div style={{background:"#060d1a",minHeight:"100vh",fontFamily:"system-ui,sans-serif",padding:"80px 20px",display:"flex",alignItems:"flex-start",justifyContent:"center"}}><div style={{maxWidth:580,width:"100%"}}><a href="/" style={{fontSize:13,color:"#6366f1",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,marginBottom:40}}>← Back to Nexyru</a><h1 style={{fontSize:36,fontWeight:900,color:"#ffffff",marginBottom:8,letterSpacing:"-0.02em"}}>Contact Us</h1><p style={{fontSize:15,color:"#6b7280",marginBottom:40,lineHeight:1.7}}>We read every message and respond within 24 hours.</p>
        {sent?(
          <div style={{padding:"40px",borderRadius:20,background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}></div><div style={{fontSize:18,fontWeight:800,color:"#10b981",marginBottom:8}}>Message sent!</div><div style={{fontSize:14,color:"#6b7280"}}>We'll get back to you at<strong style={{color:"#ffffff"}}>{email}</strong>within 24 hours.</div></div>):(<div style={{background:"linear-gradient(135deg,#111118,#111118)",border:"1px solid #2a2a3a",borderRadius:20,padding:"28px"}}><div style={{marginBottom:20}}><label style={{fontSize:11,fontWeight:700,color:"#6b7280",display:"block",marginBottom:10,letterSpacing:"0.06em",textTransform:"uppercase"}}>What's this about?</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {TOPICS.map(t=>(<button key={t.label} onClick={()=>setTopic(t)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:`1.5px solid ${topic.label===t.label?"rgba(99,102,241,0.4)":"#2a2a3a"}`,background:topic.label===t.label?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"left",outline:"none"}}><span style={{fontSize:18}}>{t.icon}</span><span style={{fontSize:13,fontWeight:topic.label===t.label?700:500,color:topic.label===t.label?"#6366f1":"#6b7280"}}>{t.label}</span>
                    {topic.label===t.label&&<span style={{marginLeft:"auto",fontSize:10,color:"#6366f1"}}>✓</span>}
                  </button>
                ))}
              </div></div><div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[{label:"Name",value:name,set:setName,type:"text",placeholder:"Your name"},{label:"Email",value:email,set:setEmail,type:"email",placeholder:"your@email.com"}].map(f=>(<div key={f.label}><label style={{fontSize:11,fontWeight:700,color:"#6b7280",display:"block",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>{f.label}</label><input type={f.type} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #2a2a3a",background:"#111118",color:"#ffffff",fontSize:14,outline:"none",boxSizing:"border-box" as any}}/></div>
              ))}
              <div><label style={{fontSize:11,fontWeight:700,color:"#6b7280",display:"block",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>Message</label><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell us what's on your mind…" rows={5} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #2a2a3a",background:"#111118",color:"#ffffff",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box" as any,fontFamily:"system-ui"}}/></div>
              {error&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",fontSize:12,color:"#ef4444"}}>{error}</div>}
              <button onClick={handleSend} disabled={!ready||sending} style={{padding:"12px",borderRadius:12,border:"none",background:ready&&!sending?"#6366f1":"#2a2a3a",color:ready&&!sending?"#fff":"#374151",fontSize:14,fontWeight:700,cursor:ready&&!sending?"pointer":"not-allowed"}}>
                {sending?"Sending…":"Send Message →"}
              </button><div style={{fontSize:11,color:"#374151",textAlign:"center"}}>Sends to founder@nexyru.com · We reply within 24 hours</div></div></div>
        )}
      </div></div>
  );
}
