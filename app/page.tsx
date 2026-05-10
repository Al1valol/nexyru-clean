"use client";
import { useState, useEffect } from "react";
const FIRMS=["Apex Trader Funding","TopstepX","FTMO","MyFundedFutures","Topstep","TradeDay","Earn2Trade","Uprofit"];
const FEATURES=[{icon:"📊",title:"AI Trade Analysis",desc:"Claude reviews every trade — detects FOMO, revenge trading, overtrading. Gets smarter the more you journal.",color:"#38bdf8"},{icon:"🏆",title:"Funded Challenge Tracker",desc:"Set your prop firm rules once. Nexyru auto-tracks daily loss limits, drawdown, profit targets.",color:"#f59e0b"},{icon:"📋",title:"Copy Top Traders",desc:"Follow verified funded traders. See their strategies and equity curves. Copy with one click.",color:"#a78bfa"},{icon:"📡",title:"Live Social Feed",desc:"Real-time feed of big wins, streaks, and milestones from the Nexyru community.",color:"#34d399"},{icon:"🔄",title:"CSV Import",desc:"Import from Tradovate, MT4/MT5, Apex, TopstepX, FTMO and more. Our reconstruction engine handles partial fills.",color:"#f97316"},{icon:"🧠",title:"Psychology Scoring",desc:"Track emotions and confidence on every trade. See how your mindset affects your P&L.",color:"#ec4899"}];
export default function HomePage(){
  const[scrolled,setScrolled]=useState(false);
  const[firmIdx,setFirmIdx]=useState(0);
  useEffect(()=>{const f=()=>setScrolled(window.scrollY>20);window.addEventListener("scroll",f);return()=>window.removeEventListener("scroll",f);},[]);
  useEffect(()=>{const t=setInterval(()=>setFirmIdx(i=>(i+1)%FIRMS.length),2000);return()=>clearInterval(t);},[]);
  return(
    <div style={{background:"#060d1a",color:"#c8d8f0",fontFamily:"system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`*{margin:0;padding:0;box-sizing:border-box;}@keyframes fadeUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes glow{0%,100%{box-shadow:0 0 30px rgba(56,189,248,0.15)}50%{box-shadow:0 0 60px rgba(56,189,248,0.35)}}.cta:hover{transform:translateY(-2px);box-shadow:0 20px 60px rgba(56,189,248,0.35)!important}.cta{transition:all 0.2s ease!important}.fc:hover{transform:translateY(-4px);border-color:rgba(255,255,255,0.12)!important}.fc{transition:all 0.2s ease!important}`}</style>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0 40px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",background:scrolled?"rgba(6,13,26,0.95)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"none",transition:"all 0.3s"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#0369a1,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📈</div><span style={{fontSize:18,fontWeight:800,color:"#f0f4ff",letterSpacing:"-0.02em"}}>Nexyru</span></div>
        <div style={{display:"flex",gap:12}}>
          <a href="/login" style={{fontSize:14,color:"#64748b",textDecoration:"none",padding:"8px 16px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)"}}>Sign in</a>
          <a href="/login" className="cta" style={{fontSize:14,fontWeight:700,color:"#fff",textDecoration:"none",padding:"9px 20px",borderRadius:10,background:"linear-gradient(135deg,#0369a1,#38bdf8)"}}>Get Started Free</a>
        </div>
      </nav>
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"120px 20px 80px",position:"relative"}}>
        <div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(ellipse,rgba(56,189,248,0.08) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",borderRadius:100,border:"1px solid rgba(56,189,248,0.25)",background:"rgba(56,189,248,0.06)",marginBottom:32,animation:"fadeUp 0.6s ease both"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#34d399",display:"inline-block",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:12,fontWeight:600,color:"#38bdf8"}}>Now live — sign up free</span>
        </div>
        <h1 style={{fontSize:"clamp(42px,7vw,84px)",fontWeight:900,lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:24,animation:"fadeUp 0.7s ease 0.1s both"}}>
          <span style={{color:"#f0f4ff"}}>The trading journal</span><br/>
          <span style={{background:"linear-gradient(135deg,#38bdf8,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>built for funded traders</span>
        </h1>
        <p style={{fontSize:"clamp(16px,2vw,20px)",color:"#64748b",maxWidth:560,lineHeight:1.7,marginBottom:40,animation:"fadeUp 0.7s ease 0.2s both"}}>AI-powered trade analysis, funded challenge tracking, and a community of verified traders — all in one platform.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginBottom:60,animation:"fadeUp 0.7s ease 0.3s both"}}>
          <a href="/login" className="cta" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"14px 28px",borderRadius:14,background:"linear-gradient(135deg,#0369a1,#38bdf8)",color:"#fff",fontSize:15,fontWeight:700,textDecoration:"none",boxShadow:"0 8px 32px rgba(56,189,248,0.25)"}}>Start for free →</a>
          <a href="/dashboard" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"14px 28px",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#94a3b8",fontSize:15,fontWeight:600,textDecoration:"none"}}>View demo</a>
        </div>
        <div style={{animation:"fadeUp 0.7s ease 0.4s both",marginBottom:80}}>
          <p style={{fontSize:12,color:"#334155",marginBottom:12,fontWeight:500}}>Works with your prop firm</p>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",borderRadius:20,border:"1px solid rgba(56,189,248,0.25)",background:"rgba(56,189,248,0.06)",fontSize:13,fontWeight:700,color:"#38bdf8"}}>{FIRMS[firmIdx]}</div>
        </div>
        <div style={{width:"100%",maxWidth:900,animation:"fadeUp 0.9s ease 0.5s both"}}>
          <div style={{background:"linear-gradient(135deg,#0b1120,#0d1628)",borderRadius:24,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 40px 80px rgba(0,0,0,0.6)"}}>
            <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:8,background:"linear-gradient(135deg,#0369a1,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>📈</div><span style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>Nexyru</span></div>
              {["Dashboard","Journal","Strategy Lab","Insights"].map(t=><span key={t} style={{fontSize:11,color:t==="Dashboard"?"#38bdf8":"#334155",fontWeight:t==="Dashboard"?700:500,padding:"4px 10px",borderRadius:8,background:t==="Dashboard"?"rgba(56,189,248,0.1)":"transparent"}}>{t}</span>)}
              <div style={{marginLeft:"auto",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",color:"#34d399"}}>LIVE</div>
            </div>
            <div style={{padding:"20px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[{l:"Total P&L",v:"+$8,432",c:"#34d399",s:"+12.4%"},{l:"Win Rate",v:"67.3%",c:"#38bdf8",s:"128 trades"},{l:"Profit Target",v:"84%",c:"#f59e0b",s:"$8.4k / $10k"},{l:"Daily Loss",v:"Safe",c:"#34d399",s:"-$240 / -$3k"}].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:14,padding:"14px",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{fontSize:9,color:"#334155",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{s.l}</div>
                  <div style={{fontSize:20,fontWeight:900,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
                  <div style={{fontSize:10,color:"#475569",marginTop:4}}>{s.s}</div>
                </div>
              ))}
            </div>
            <div style={{padding:"0 20px 20px"}}>
              <div style={{background:"rgba(255,255,255,0.02)",borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,0.04)"}}>
                {[{p:"ES1!",t:"LONG",pnl:"+$312.50",c:"#34d399",g:"A"},{p:"NQ1!",t:"SHORT",pnl:"+$187.50",c:"#34d399",g:"B+"},{p:"CL1!",t:"LONG",pnl:"-$95.00",c:"#f87171",g:"C"}].map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderBottom:i<2?"1px solid rgba(255,255,255,0.03)":"none"}}>
                    <span style={{fontSize:11,fontWeight:800,color:"#e2e8f0",fontFamily:"monospace",width:40}}>{t.p}</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:t.t==="LONG"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",color:t.t==="LONG"?"#34d399":"#f87171"}}>{t.t}</span>
                    <span style={{flex:1}}/>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:"rgba(56,189,248,0.1)",color:"#38bdf8"}}>Grade {t.g}</span>
                    <span style={{fontSize:12,fontWeight:900,color:t.c,fontFamily:"monospace"}}>{t.pnl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section style={{padding:"80px 40px",borderTop:"1px solid rgba(255,255,255,0.05)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:40,textAlign:"center"}}>
          {[{v:"47%",l:"Avg win rate improvement"},{v:"2.3x",l:"Better risk/reward ratio"},{v:"10K+",l:"Trades analyzed"},{v:"500+",l:"Funded traders"}].map((s,i)=>(
            <div key={i}><div style={{fontSize:48,fontWeight:900,color:"#f0f4ff",fontFamily:"monospace",letterSpacing:"-0.03em",lineHeight:1}}>{s.v}</div><div style={{fontSize:13,color:"#475569",marginTop:8}}>{s.l}</div></div>
          ))}
        </div>
      </section>
      <section style={{padding:"100px 40px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:64}}>
            <div style={{fontSize:11,fontWeight:700,color:"#38bdf8",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>Everything you need</div>
            <h2 style={{fontSize:"clamp(32px,5vw,52px)",fontWeight:900,color:"#f0f4ff",letterSpacing:"-0.03em",lineHeight:1.1}}>Built for serious traders</h2>
            <p style={{fontSize:16,color:"#475569",marginTop:16,maxWidth:500,margin:"16px auto 0"}}>Every feature was designed around the needs of funded traders and serious prop firm challengers.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {FEATURES.map((f,i)=>(
              <div key={i} className="fc" style={{background:"linear-gradient(135deg,#0b1120,#0d1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"28px 24px"}}>
                <div style={{width:48,height:48,borderRadius:14,background:`${f.color}15`,border:`1px solid ${f.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:18}}>{f.icon}</div>
                <h3 style={{fontSize:16,fontWeight:800,color:"#f0f4ff",marginBottom:10}}>{f.title}</h3>
                <p style={{fontSize:13,color:"#475569",lineHeight:1.7}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{padding:"80px 40px",background:"rgba(255,255,255,0.015)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
          <h2 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:900,color:"#f0f4ff",letterSpacing:"-0.02em",marginBottom:16}}>Trusted by funded traders</h2>
          <p style={{fontSize:15,color:"#475569",marginBottom:40}}>Join traders from every major prop firm who use Nexyru to track and improve.</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",marginBottom:60}}>
            {FIRMS.map((f,i)=><div key={i} style={{padding:"8px 18px",borderRadius:100,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",fontSize:13,color:"#64748b",fontWeight:500}}>{f}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {[{text:"Finally a journal that understands funded traders. The challenge tracker alone saved my Apex account.",name:"Jake M.",firm:"Apex Trader Funding"},{text:"Went from 45% to 68% win rate in 60 days. The AI feedback is brutally honest and exactly what I needed.",name:"Sarah K.",firm:"TopstepX"},{text:"Copy trading feature is insane. I follow two consistently profitable traders and model my setups after theirs.",name:"Dev R.",firm:"FTMO"}].map((t,i)=>(
              <div key={i} style={{background:"linear-gradient(135deg,#0b1120,#0d1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px",textAlign:"left"}}>
                <p style={{fontSize:13,color:"#94a3b8",lineHeight:1.7,marginBottom:16,fontStyle:"italic"}}>"{t.text}"</p>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,rgba(56,189,248,0.2),rgba(167,139,250,0.2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#38bdf8"}}>{t.name[0]}</div>
                  <div><div style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{t.name}</div><div style={{fontSize:10,color:"#334155"}}>{t.firm}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{padding:"100px 40px",textAlign:"center",position:"relative"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:500,height:500,borderRadius:"50%",background:"radial-gradient(ellipse,rgba(56,189,248,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <h2 style={{fontSize:"clamp(32px,5vw,56px)",fontWeight:900,color:"#f0f4ff",letterSpacing:"-0.03em",marginBottom:20}}>Ready to trade smarter?</h2>
          <p style={{fontSize:16,color:"#475569",maxWidth:440,margin:"0 auto 40px",lineHeight:1.7}}>Start free. Import your first trades in minutes. See what AI-powered insights can do for your P&L.</p>
          <a href="/login" className="cta" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"16px 36px",borderRadius:16,background:"linear-gradient(135deg,#0369a1,#38bdf8)",color:"#fff",fontSize:16,fontWeight:700,textDecoration:"none",boxShadow:"0 8px 40px rgba(56,189,248,0.3)",animation:"glow 3s ease-in-out infinite"}}>Get started free →</a>
          <div style={{marginTop:20,fontSize:12,color:"#334155"}}>No credit card required · Works with all prop firms</div>
        </div>
      </section>
      <footer style={{padding:"40px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0369a1,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📈</div><span style={{fontSize:15,fontWeight:800,color:"#f0f4ff"}}>Nexyru</span></div>
        <div style={{display:"flex",gap:24}}>{["Privacy","Terms","Contact"].map(l=><a key={l} href="#" style={{fontSize:12,color:"#334155",textDecoration:"none"}}>{l}</a>)}</div>
        <div style={{fontSize:12,color:"#1e2f4a"}}>© 2026 Nexyru. All rights reserved.</div>
      </footer>
    </div>
  );
}