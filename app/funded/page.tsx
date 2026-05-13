"use client";
import { useState, useEffect, useMemo } from "react";

interface Challenge { id:string; name:string; startDate:string; endDate:string; startBalance:number; profitTarget:number; maxDrawdown:number; dailyLoss:number; minTrades:number; status:"active"|"passed"|"failed"; failReason?:string; }
interface Trade { id:string; date:string; pnl:number; pair:string; type:string; }

const CK = "nexyru_challenge_v1";
const getUser = () => { try { return JSON.parse(localStorage.getItem("tradedesk_session_v1")??"{}").username??""; } catch { return ""; } };
const getTrades = (u:string):Trade[] => { try { return JSON.parse(localStorage.getItem(`tradedesk_trades_${u}_v1`)??"[]"); } catch { return []; } };
const saveC = (c:Challenge|null) => localStorage.setItem(CK, JSON.stringify(c));
const loadC = ():Challenge|null => { try { return JSON.parse(localStorage.getItem(CK)??"null"); } catch { return null; } };

function evalChallenge(ch:Challenge, trades:Trade[]) {
  const start = new Date(ch.startDate), end = new Date(ch.endDate), now = new Date();
  const ct = trades.filter(t => { const d=new Date(t.date); return d>=start&&d<=end; });
  const pnl = ct.reduce((s,t)=>s+(t.pnl??0),0);
  const pct = (pnl/ch.startBalance)*100;
  const wins = ct.filter(t=>(t.pnl??0)>0).length;
  const wr = ct.length>0?(wins/ct.length)*100:0;
  let peak=ch.startBalance,bal=ch.startBalance,maxDD=0;
  for(const t of [...ct].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime())) {
    bal+=t.pnl??0; if(bal>peak)peak=bal;
    const dd=((peak-bal)/peak)*100; if(dd>maxDD)maxDD=dd;
  }
  const byDay:Record<string,number>={};
  ct.forEach(t=>{ const d=new Date(t.date).toDateString(); byDay[d]=(byDay[d]??0)+(t.pnl??0); });
  const worstDay=Math.min(...Object.values(byDay),0);
  const worstDayPct=Math.abs(worstDay/ch.startBalance*100);
  const daysTotal=Math.ceil((end.getTime()-start.getTime())/86400000);
  const daysElapsed=Math.ceil((now.getTime()-start.getTime())/86400000);
  const daysRemaining=Math.max(0,Math.ceil((end.getTime()-now.getTime())/86400000));
  const rules=[
    {id:"profit",label:"Profit Target",target:ch.profitTarget,current:pct,unit:"%",passed:pct>=ch.profitTarget,failed:false,desc:`Reach +${ch.profitTarget}%`,progress:Math.min(100,Math.max(0,(pct/ch.profitTarget)*100)),color:"#34d399",isGoal:true},
    {id:"drawdown",label:"Max Drawdown",target:ch.maxDrawdown,current:maxDD,unit:"%",passed:maxDD<ch.maxDrawdown,failed:maxDD>=ch.maxDrawdown,desc:`Never exceed -${ch.maxDrawdown}% drawdown`,progress:Math.min(100,(maxDD/ch.maxDrawdown)*100),color:"#f87171",isGoal:false},
    {id:"daily",label:"Daily Loss Limit",target:ch.dailyLoss,current:worstDayPct,unit:"%",passed:worstDayPct<ch.dailyLoss,failed:worstDayPct>=ch.dailyLoss,desc:`Max -${ch.dailyLoss}% in one day`,progress:Math.min(100,(worstDayPct/ch.dailyLoss)*100),color:"#fbbf24",isGoal:false},
    {id:"trades",label:"Min Trades",target:ch.minTrades,current:ct.length,unit:"",passed:ct.length>=ch.minTrades,failed:false,desc:`Complete ${ch.minTrades}+ trades`,progress:Math.min(100,(ct.length/ch.minTrades)*100),color:"#38bdf8",isGoal:true},
  ];
  const hardFails=rules.filter(r=>r.failed);
  const allGoals=rules.filter(r=>r.isGoal).every(r=>r.passed)&&rules.filter(r=>!r.isGoal).every(r=>!r.failed);
  const isExpired=now>end;
  return { ct,pnl,pct,wr,maxDD,worstDayPct,daysTotal,daysElapsed,daysRemaining,rules,isPassed:allGoals,isFailed:hardFails.length>0||(isExpired&&!allGoals),failReason:hardFails[0]?.label??(isExpired?"Time expired":undefined) };
}

const inp:React.CSSProperties={width:"100%",padding:"9px 12px",borderRadius:9,border:"1px solid #1a2540",background:"#0d1628",color:"#f0f4ff",fontSize:14,fontWeight:700,fontFamily:"monospace",outline:"none",boxSizing:"border-box"};
const lbl:React.CSSProperties={fontSize:10,fontWeight:700,color:"#4a5a7a",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6};

function NewForm({onStart}:{onStart:(c:Challenge)=>void}) {
  const [name,setName]=useState("My Funded Challenge");
  const [bal,setBal]=useState("10000");
  const [profit,setProfit]=useState("10");
  const [dd,setDd]=useState("5");
  const [daily,setDaily]=useState("2");
  const [days,setDays]=useState("30");
  const [mint,setMint]=useState("10");
  const start=()=>{
    const sd=new Date().toISOString();
    const ed=new Date(Date.now()+parseInt(days)*86400000).toISOString();
    onStart({id:`ch_${Date.now()}`,name,startDate:sd,endDate:ed,startBalance:parseFloat(bal)||10000,profitTarget:parseFloat(profit)||10,maxDrawdown:parseFloat(dd)||5,dailyLoss:parseFloat(daily)||2,minTrades:parseInt(mint)||10,status:"active"});
  };
  return (
    <div style={{maxWidth:520,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:48,marginBottom:10}}>🏆</div><h2 style={{fontSize:22,fontWeight:900,color:"#f0f4ff",margin:"0 0 8px"}}>Start a Funded Challenge</h2><p style={{fontSize:13,color:"#3a4a6a",margin:0}}>Set your rules. Trade to the target. Unlock Funded Trader rank.</p></div>
      <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:20,padding:28}}>
        <div style={{marginBottom:16}}><label style={lbl}>Challenge Name</label><input value={name} onChange={e=>setName(e.target.value)} style={inp}/></div>
        <div style={{marginBottom:16}}><label style={lbl}>Starting Balance ($)</label><input value={bal} onChange={e=>setBal(e.target.value)} type="number" style={inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <div><label style={lbl}>Profit Target (%)</label><input value={profit} onChange={e=>setProfit(e.target.value)} type="number" style={inp}/><div style={{fontSize:10,color:"#2e3f5a",marginTop:4}}>Need +${Math.round((parseFloat(bal)||10000)*(parseFloat(profit)||10)/100)}</div></div>
          <div><label style={lbl}>Time Limit (days)</label><input value={days} onChange={e=>setDays(e.target.value)} type="number" style={inp}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <div><label style={lbl}>Max Drawdown (%)</label><input value={dd} onChange={e=>setDd(e.target.value)} type="number" style={inp}/><div style={{fontSize:10,color:"#2e3f5a",marginTop:4}}>Breach = instant fail</div></div>
          <div><label style={lbl}>Daily Loss Limit (%)</label><input value={daily} onChange={e=>setDaily(e.target.value)} type="number" style={inp}/></div>
        </div>
        <div style={{marginBottom:20}}><label style={lbl}>Minimum Trades</label><input value={mint} onChange={e=>setMint(e.target.value)} type="number" style={inp}/></div>
        <div style={{padding:"12px 14px",borderRadius:10,background:"rgba(56,189,248,0.05)",border:"1px solid rgba(56,189,248,0.15)",marginBottom:20,fontSize:11,color:"#3a6a8a",lineHeight:1.8}}>
          <strong style={{color:"#38bdf8"}}>To pass:</strong> Reach +{profit}% in {days} days, {mint}+ trades, never exceed -{dd}% drawdown or -{daily}% in one day.
        </div>
        <button onClick={start} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer"}}>🚀 Start Challenge</button>
      </div>
    </div>
  );
}

function ActiveView({challenge,onReset}:{challenge:Challenge;onReset:()=>void}) {
  const username=useMemo(()=>getUser(),[]);
  const trades=useMemo(()=>getTrades(username),[username]);
  const ev=useMemo(()=>evalChallenge(challenge,trades),[challenge,trades]);
  const [confirmingAbandon,setConfirmingAbandon]=useState(false);

  useEffect(()=>{
    if(ev.isPassed&&challenge.status==="active") saveC({...challenge,status:"passed"});
    else if(ev.isFailed&&challenge.status==="active") saveC({...challenge,status:"failed",failReason:ev.failReason});
  },[ev.isPassed,ev.isFailed]);

  const pos=ev.pnl>=0;
  const progPct=Math.min(100,Math.max(0,(ev.pct/challenge.profitTarget)*100));
  const timePct=Math.min(100,(ev.daysElapsed/ev.daysTotal)*100);
  const ss=challenge.status==="passed"?{bg:"rgba(52,211,153,0.08)",border:"rgba(52,211,153,0.4)",color:"#34d399",label:"✅ PASSED",emoji:"🏆"}:challenge.status==="failed"?{bg:"rgba(239,68,68,0.08)",border:"rgba(239,68,68,0.4)",color:"#f87171",label:"❌ FAILED",emoji:"💀"}:{bg:"rgba(56,189,248,0.06)",border:"rgba(56,189,248,0.3)",color:"#38bdf8",label:"🟢 ACTIVE",emoji:"⚡"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:ss.bg,border:`1px solid ${ss.border}`,borderRadius:24,padding:"28px 28px 24px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:20}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><span style={{fontSize:28}}>{ss.emoji}</span><h2 style={{fontSize:20,fontWeight:900,color:"#f0f4ff",margin:0}}>{challenge.name}</h2></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:20,background:`${ss.color}20`,border:`1px solid ${ss.color}44`,color:ss.color}}>{ss.label}</span>
              <span style={{fontSize:11,color:"#3a4a6a"}}>{new Date(challenge.startDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})} → {new Date(challenge.endDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#3a4a6a",marginBottom:4}}>Balance</div>
            <div style={{fontSize:24,fontWeight:900,fontFamily:"monospace",color:pos?"#34d399":"#f87171"}}>${(challenge.startBalance+ev.pnl).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
            <div style={{fontSize:11,color:pos?"#34d399":"#f87171",fontWeight:700}}>{pos?"+":""}{ev.pct.toFixed(2)}%</div>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:10,color:"#3a4a6a",fontWeight:700}}>Profit Progress</span><span style={{fontSize:10,color:"#34d399",fontWeight:700}}>{ev.pct.toFixed(2)}% / {challenge.profitTarget}%</span></div>
          <div style={{height:8,borderRadius:4,background:"#111d30",overflow:"hidden"}}><div style={{width:`${progPct}%`,height:"100%",background:"linear-gradient(90deg,#0ea5a0,#34d399)",borderRadius:4,transition:"width 0.6s"}}/></div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:10,color:"#3a4a6a",fontWeight:700}}>Time</span><span style={{fontSize:10,color:ev.daysRemaining<=3?"#f87171":"#3a4a6a",fontWeight:700}}>{ev.daysRemaining} days left</span></div>
          <div style={{height:4,borderRadius:2,background:"#111d30",overflow:"hidden"}}><div style={{width:`${timePct}%`,height:"100%",background:ev.daysRemaining<=3?"linear-gradient(90deg,#ef4444,#fbbf24)":"linear-gradient(90deg,#3b82f6,#38bdf8)",borderRadius:2}}/></div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
        {ev.rules.map(r=>{
          const rc=r.failed?"#f87171":r.passed?"#34d399":r.color;
          return(
            <div key={r.id} style={{background:r.failed?"rgba(239,68,68,0.06)":r.passed?"rgba(52,211,153,0.06)":"rgba(30,41,59,0.3)",border:`1px solid ${r.failed?"rgba(239,68,68,0.35)":r.passed?"rgba(52,211,153,0.3)":"#1a2540"}`,borderRadius:16,padding:"16px 18px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div><div style={{fontSize:12,fontWeight:800,color:r.failed?"#f87171":r.passed?"#34d399":"#e2e8f0"}}>{r.label}</div><div style={{fontSize:10,color:"#3a4a6a",marginTop:2}}>{r.desc}</div></div>
                <span style={{fontSize:18}}>{r.failed?"❌":r.passed?"✅":"⏳"}</span>
              </div>
              <div style={{height:4,borderRadius:2,background:"#111d30",marginBottom:6,overflow:"hidden"}}><div style={{width:`${r.progress}%`,height:"100%",background:`linear-gradient(90deg,${rc}66,${rc})`,borderRadius:2}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:"monospace"}}>
                <span style={{color:rc,fontWeight:800}}>{r.current.toFixed(r.unit==="%"?2:0)}{r.unit}</span>
                <span style={{color:"#2e3f5a"}}>{r.isGoal?`target: ${r.target}${r.unit}`:`limit: ${r.target}${r.unit}`}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:16,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",borderBottom:"1px solid #111827",fontSize:12,fontWeight:700,color:"#94a3b8"}}>Challenge Stats</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"}}>
          {[{l:"Trades",v:String(ev.ct.length),c:"#94a3b8"},{l:"Win Rate",v:`${ev.wr.toFixed(0)}%`,c:ev.wr>=55?"#34d399":ev.wr>=45?"#fbbf24":"#f87171"},{l:"Max DD",v:`${ev.maxDD.toFixed(2)}%`,c:ev.maxDD<challenge.maxDrawdown?"#34d399":"#f87171"},{l:"Worst Day",v:`${ev.worstDayPct.toFixed(2)}%`,c:ev.worstDayPct<challenge.dailyLoss?"#34d399":"#f87171"},{l:"Days Left",v:String(ev.daysRemaining),c:ev.daysRemaining>5?"#94a3b8":ev.daysRemaining>2?"#fbbf24":"#f87171"}].map((s,i,arr)=>(
            <div key={i} style={{padding:"12px 0",textAlign:"center",borderRight:i<arr.length-1?"1px solid #111827":"none"}}>
              <div style={{fontSize:9,color:"#3a4a6a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {challenge.status==="passed"&&<div style={{padding:24,borderRadius:16,background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.4)",textAlign:"center"}}><div style={{fontSize:48,marginBottom:8}}>🏆</div><div style={{fontSize:20,fontWeight:900,color:"#34d399",marginBottom:6}}>Challenge Passed!</div><div style={{fontSize:13,color:"#3a6a8a",marginBottom:16}}>You've met all requirements. Funded Trader rank unlocked.</div><a href="/dashboard" style={{display:"inline-block",padding:"10px 24px",borderRadius:10,background:"linear-gradient(135deg,#0ea5a0,#34d399)",color:"#000",fontSize:13,fontWeight:800,textDecoration:"none"}}>View Dashboard →</a></div>}
      {challenge.status==="failed"&&<div style={{padding:24,borderRadius:16,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.35)",textAlign:"center"}}><div style={{fontSize:48,marginBottom:8}}>💀</div><div style={{fontSize:20,fontWeight:900,color:"#f87171",marginBottom:6}}>Challenge Failed</div><div style={{fontSize:13,color:"#7a3a3a",marginBottom:4}}>Reason: {challenge.failReason}</div><div style={{fontSize:12,color:"#3a4a6a",marginBottom:20}}>Study what went wrong, then try again.</div><button onClick={onReset} style={{padding:"10px 24px",borderRadius:10,background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",color:"#f87171",fontSize:13,fontWeight:800,cursor:"pointer"}}>Start New Challenge</button></div>}
      {challenge.status==="active"&&<div style={{textAlign:"center"}}>
        {confirmingAbandon ? (
          <div style={{display:"inline-flex",gap:6}}>
            <button onClick={()=>{setConfirmingAbandon(false);onReset();}} style={{padding:"8px 16px",borderRadius:9,border:"1px solid #f87171",background:"rgba(239,68,68,0.15)",color:"#fca5a5",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Abandon</button>
            <button onClick={()=>setConfirmingAbandon(false)} style={{padding:"8px 16px",borderRadius:9,border:"1px solid #334155",background:"transparent",color:"#94a3b8",fontSize:11,fontWeight:700,cursor:"pointer"}}>✗ Cancel</button>
          </div>
        ) : (
          <button onClick={()=>{setConfirmingAbandon(true);setTimeout(()=>setConfirmingAbandon(curr=>curr?false:curr),3000);}} style={{padding:"8px 18px",borderRadius:9,border:"1px solid rgba(239,68,68,0.2)",background:"transparent",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>Abandon Challenge</button>
        )}
      </div>}
    </div>
  );
}

export default function FundedPage() {
  const [challenge,setChallenge]=useState<Challenge|null>(null);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{ setChallenge(loadC()); setLoaded(true); },[]);
  if(!loaded) return <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#3a4a6a"}}>Loading…</div>;
  return (
    <div style={{minHeight:"100vh",background:"#060d1a",color:"#c8d8f0",fontFamily:"system-ui,sans-serif"}}>
      <div style={{borderBottom:"1px solid #0d1628",background:"rgba(6,13,26,0.95)",padding:"14px 28px",display:"flex",alignItems:"center",gap:16,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(8px)"}}>
        <a href="/dashboard" style={{fontSize:12,color:"#3a4a6a",textDecoration:"none"}}>← Dashboard</a>
        <span style={{fontSize:14,fontWeight:800,color:"#f0f4ff"}}>Funded Challenge</span>
        <div style={{flex:1}}/>
        {challenge&&<span style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,background:challenge.status==="passed"?"rgba(52,211,153,0.1)":challenge.status==="failed"?"rgba(239,68,68,0.1)":"rgba(167,139,250,0.1)",border:`1px solid ${challenge.status==="passed"?"rgba(52,211,153,0.3)":challenge.status==="failed"?"rgba(239,68,68,0.3)":"rgba(167,139,250,0.3)"}`,color:challenge.status==="passed"?"#34d399":challenge.status==="failed"?"#f87171":"#a78bfa"}}>{challenge.status==="passed"?"✅ Passed":challenge.status==="failed"?"❌ Failed":"🟢 Active"}</span>}
        <a href="/dashboard" style={{padding:"6px 14px",borderRadius:8,border:"1px solid #1a2540",background:"#0b1120",color:"#4a5a7a",fontSize:11,fontWeight:600,textDecoration:"none"}}>Dashboard</a>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"32px 24px"}}>
        {!challenge?<NewForm onStart={c=>{saveC(c);setChallenge(c);}}/>:<ActiveView challenge={challenge} onReset={()=>{saveC(null);setChallenge(null);}}/>}
      </div>
    </div>
  );
}
