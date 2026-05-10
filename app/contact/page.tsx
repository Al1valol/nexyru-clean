"use client";
import{useState}from"react";
export default function Contact(){
  const[sent,setSent]=useState(false);
  const[form,setForm]=useState({name:"",email:"",message:""});
  return(<div style={{background:"#060d1a",minHeight:"100vh",fontFamily:"system-ui,sans-serif",padding:"80px 20px",display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
    <div style={{maxWidth:560,width:"100%"}}>
      <a href="/" style={{fontSize:13,color:"#38bdf8",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,marginBottom:40}}>← Back to Nexyru</a>
      <h1 style={{fontSize:36,fontWeight:900,color:"#f0f4ff",marginBottom:8,letterSpacing:"-0.02em"}}>Contact Us</h1>
      <p style={{fontSize:15,color:"#475569",marginBottom:40,lineHeight:1.7}}>Have a question, bug report, or feature request? We'd love to hear from you.</p>
      <div style={{display:"flex",gap:16,marginBottom:40,flexWrap:"wrap"}}>
        {[{icon:"📧",label:"General",val:"hello@nexyru.com"},{icon:"🔒",label:"Privacy",val:"privacy@nexyru.com"},{icon:"⚖️",label:"Legal",val:"legal@nexyru.com"}].map((c,i)=>(
          <div key={i} style={{flex:1,minWidth:140,padding:"16px",borderRadius:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:8}}>{c.icon}</div>
            <div style={{fontSize:11,color:"#334155",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.label}</div>
            <div style={{fontSize:12,color:"#38bdf8"}}>{c.val}</div>
          </div>
        ))}
      </div>
      {sent?(<div style={{padding:"24px",borderRadius:16,background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>✅</div><div style={{fontSize:16,fontWeight:700,color:"#34d399",marginBottom:8}}>Message sent!</div><div style={{fontSize:13,color:"#475569"}}>We'll get back to you within 24 hours.</div></div>):(
        <div style={{background:"linear-gradient(135deg,#0d1628,#0f1e30)",border:"1px solid #1a2540",borderRadius:20,padding:"28px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {[{label:"Name",key:"name",type:"text",placeholder:"Your name"},{label:"Email",key:"email",type:"email",placeholder:"your@email.com"}].map(f=>(
              <div key={f.key}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #1a2540",background:"#0b1120",color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box" as any}}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>Message</label>
              <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="Tell us what's on your mind…" rows={5} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #1a2540",background:"#0b1120",color:"#e2e8f0",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box" as any,fontFamily:"system-ui"}}/>
            </div>
            <button onClick={()=>setSent(true)} disabled={!form.name||!form.email||!form.message} style={{padding:"12px",borderRadius:12,border:"none",background:form.name&&form.email&&form.message?"linear-gradient(135deg,#0369a1,#38bdf8)":"#1a2540",color:form.name&&form.email&&form.message?"#fff":"#334155",fontSize:14,fontWeight:700,cursor:form.name&&form.email&&form.message?"pointer":"not-allowed"}}>Send Message →</button>
          </div>
        </div>
      )}
    </div>
  </div>);
}
