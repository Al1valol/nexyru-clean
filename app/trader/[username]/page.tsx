"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────
interface Strategy {
  id: string; name: string; status: string; monthly_price: number;
  created_at: string; user_id: string;
  backtest_results: { return_pct:number; win_rate:number; max_drawdown:number; trades_count:number }[];
}
interface Trade {
  id:string; pair:string; type:string; pnl:number; date:number;
  entryPrice:number; exitPrice:number; size:number; strategy:string; source?:string;
}
interface ProfileStats {
  totalTrades:number; verifiedTrades:number; winRate:number; avgRR:number;
  consistency:number; maxDrawdown:number; totalPnl:number; monthlyReturn:number;
  bestStreak:number; currentWinStreak:number; currentTradeStreak:number; bestTradeStreak:number;
  joinDate:string; equityCurve:{label:string;value:number}[];
}
interface Badge { id:string; label:string; icon:string; color:string; desc:string; }

// ── Helpers ────────────────────────────────────────────────────
function getRank(s:ProfileStats) {
  if(s.totalTrades>=200&&s.winRate>=60&&s.consistency>=80) return{label:"Funded Trader",  color:"#f59e0b",next:"Max rank",          progress:100};
  if(s.totalTrades>=100&&s.winRate>=55&&s.consistency>=70) return{label:"Verified Trader",color:"#a78bfa",next:"Funded Trader",      progress:Math.min(100,((s.totalTrades-100)/100)*100)};
  if(s.totalTrades>=50 &&s.winRate>=50&&s.consistency>=55) return{label:"Consistent",     color:"#34d399",next:"Verified Trader",    progress:Math.min(100,((s.totalTrades-50)/50)*100)};
  if(s.totalTrades>=20)                                    return{label:"Active Trader",  color:"#38bdf8",next:"Consistent",         progress:Math.min(100,((s.totalTrades-20)/30)*100)};
  return                                                         {label:"Beginner",        color:"#64748b",next:"Active Trader",      progress:Math.min(100,(s.totalTrades/20)*100)};
}
function getBadges(s:ProfileStats,strats:Strategy[]):Badge[] {
  const b:Badge[]=[];
  if(s.winRate>=60)         b.push({id:"wr",   label:"Sharp Shooter",  icon:"🎯",color:"#34d399",desc:"60%+ win rate"});
  if(s.consistency>=75)     b.push({id:"con",  label:"Consistent",     icon:"📊",color:"#38bdf8",desc:"75+ score"});
  if(s.totalTrades>=100)    b.push({id:"100",  label:"Centurion",      icon:"💯",color:"#a78bfa",desc:"100+ trades"});
  if(s.maxDrawdown<10)      b.push({id:"dd",   label:"Risk Master",    icon:"🛡️",color:"#22d3a5",desc:"DD under 10%"});
  if(s.bestStreak>=5)       b.push({id:"str",  label:"On Fire",        icon:"🔥",color:"#f97316",desc:"5+ win streak"});
  if(s.totalPnl>0)          b.push({id:"pnl",  label:"In The Green",   icon:"💚",color:"#34d399",desc:"Positive PnL"});
  if(s.verifiedTrades>=50)  b.push({id:"ver",  label:"Verified Funded",icon:"✅",color:"#f59e0b",desc:"50+ broker trades"});
  if(strats.some(x=>x.status==="verified")) b.push({id:"vs",label:"Verified Strategy",icon:"✓",color:"#a78bfa",desc:"Verified strategy"});
  if(strats.some(x=>(x.monthly_price??0)>0))b.push({id:"earn",label:"Earning",icon:"💰",color:"#fbbf24",desc:"Paid subscribers"});
  return b;
}
function calcConsistency(wr:number,dd:number,total:number){
  if(total<5)return 0;
  return Math.round(Math.min(100,wr*1.4)*0.5+Math.max(0,100-dd*3)*0.3+Math.min(100,total/2)*0.2);
}

// ── Small Components ───────────────────────────────────────────
function StatCard({label,value,color,sub}:{label:string;value:string;color?:string;sub?:string}){
  return(
    <div style={{background:"#0d1628",border:"1px solid #1a2540",borderRadius:14,padding:"16px",textAlign:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-15,right:-15,width:50,height:50,borderRadius:"50%",background:`${color??"#38bdf8"}08`,pointerEvents:"none"}}/>
      <div style={{fontSize:9,fontWeight:700,color:"#3a4a6a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{label}</div>
      <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:color??"#f0f4ff",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:"#3a4a6a",marginTop:5}}>{sub}</div>}
    </div>
  );
}
function EquityTooltip({active,payload,label}:any){
  if(!active||!payload?.length)return null;
  const v=payload[0].value as number;
  return(
    <div style={{background:"#0d1628",border:"1px solid #1a2540",borderRadius:10,padding:"10px 14px",fontSize:11}}>
      <div style={{color:"#64748b",marginBottom:4}}>{label}</div>
      <div style={{color:v>=0?"#34d399":"#f87171",fontWeight:700,fontFamily:"monospace"}}>{v>=0?"+":""}{v.toFixed(2)}</div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TraderProfile(){
  const params=useParams();
  const username=decodeURIComponent((params?.username as string)??"").replace(/^@/,"");

  const [tab,setTab]=useState<"overview"|"trades"|"strategies"|"analytics">("overview");
  const [strategies,setStrategies]=useState<Strategy[]>([]);
  const [trades,setTrades]=useState<Trade[]>([]);
  const [stats,setStats]=useState<ProfileStats|null>(null);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  const [followerCounts,setFollowerCounts]=useState<Record<string,number>>({});
  const [isFollowing,setIsFollowing]=useState(false);
  const [followerCount,setFollowerCount]=useState(0);
  const [followLoading,setFollowLoading]=useState(false);
  const [currentUser,setCurrentUser]=useState("");
  const [copied,setCopied]=useState(false);
  const [shareDone,setShareDone]=useState(false);

  useEffect(()=>{
    if(!username)return;
    loadProfile();
    try{const s=JSON.parse(localStorage.getItem("tradedesk_session_v1")??"{}");setCurrentUser(s.username??"");}catch{}
  },[username]);

  useEffect(()=>{
    if(!currentUser||!username||currentUser===username)return;
    fetch(`/api/trader-follows?follower_id=${currentUser}&trader_id=${username}`)
      .then(r=>r.json()).then(d=>{if(Array.isArray(d)&&d.length>0)setIsFollowing(true);}).catch(()=>{});
    fetch(`/api/trader-follows?trader_id=${username}`)
      .then(r=>r.json()).then(d=>{if(Array.isArray(d))setFollowerCount(d.length);}).catch(()=>{});
  },[currentUser,username]);

  const toggleFollow=async()=>{
    if(!currentUser||followLoading)return;
    setFollowLoading(true);
    try{
      if(isFollowing){
        await fetch("/api/trader-follows",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({follower_id:currentUser,trader_id:username})});
        setIsFollowing(false);setFollowerCount(p=>Math.max(0,p-1));
      }else{
        await fetch("/api/trader-follows",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({follower_id:currentUser,trader_id:username})});
        setIsFollowing(true);setFollowerCount(p=>p+1);
        fetch("/api/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:currentUser,type:"followed_trader",data:{trader:username}})}).catch(()=>{});
      }
    }catch{}
    setFollowLoading(false);
  };

  const handleCopy=async()=>{
    if(copied)return;
    await toggleFollow();
    fetch("/api/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:currentUser,type:"copy_trader",data:{trader:username}})}).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false),3000);
  };

  const handleShare=()=>{
    const url=window.location.href;
    navigator.clipboard?.writeText(url).catch(()=>{});
    setShareDone(true);setTimeout(()=>setShareDone(false),2000);
  };

  const loadProfile=async()=>{
    setLoading(true);
    try{
      const [bt,live,ver]=await Promise.all([
        fetch("/api/leaderboard?status=backtested").then(r=>r.json()),
        fetch("/api/leaderboard?status=live").then(r=>r.json()),
        fetch("/api/leaderboard?status=verified").then(r=>r.json()),
      ]);
      const allStrats:Strategy[]=[...(Array.isArray(bt)?bt:[]),...(Array.isArray(live)?live:[]),...(Array.isArray(ver)?ver:[])].filter((s:any)=>s.user_id===username);

      const counts:Record<string,number>={};
      await Promise.all(allStrats.map(async s=>{const d=await fetch(`/api/follow?strategy_id=${s.id}`).then(r=>r.json());counts[s.id]=d.count??0;}));
      setFollowerCounts(counts);

      // Allow profiles without published strategies

      let winRate=0,maxDD=0,totalPnl=0,total=0,bestStreak=0;
      let currentWinStreak=0,currentTradeStreak=0,bestTradeStreak=0,verifiedTrades=0;
      let realTrades:Trade[]=[],equityCurve:{label:string;value:number}[]=[];
      try{
        const raw:any[]=JSON.parse(localStorage.getItem(`tradedesk_trades_${username}_v1`)??"[]");
        if(raw.length>0){
          realTrades=[...raw].sort((a,b)=>a.date-b.date);
          total=raw.length;
          verifiedTrades=raw.filter(t=>t.source==="broker_import").length;
          const wins=raw.filter(t=>(t.pnl??0)>0).length;
          winRate=Math.round((wins/total)*100);
          totalPnl=raw.reduce((s:number,t:any)=>s+(t.pnl??0),0);
          let cum=0;
          equityCurve=realTrades.map(t=>({label:new Date(t.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}),value:parseFloat((cum+=t.pnl??0).toFixed(2))}));
          let peak=0,bal=0,streak=0,maxStreak=0;
          for(const t of raw){
            bal+=t.pnl??0;
            if(bal>peak)peak=bal;
            const dd=peak>0?((peak-bal)/peak)*100:0;
            if(dd>maxDD)maxDD=dd;
            if((t.pnl??0)>0){streak++;if(streak>maxStreak)maxStreak=streak;}else streak=0;
          }
          bestStreak=maxStreak;currentWinStreak=streak;
          const days=[...new Set(raw.map((t:any)=>new Date(t.date).toISOString().split("T")[0]))].sort() as string[];
          let ds=1,bd=1;
          for(let i=1;i<days.length;i++){const diff=Math.round((new Date(days[i]).getTime()-new Date(days[i-1]).getTime())/86400000);if(diff===1){ds++;if(ds>bd)bd=ds;}else ds=1;}
          if(days.length===1)bd=1;
          const ld=days[days.length-1]??"";const today=new Date().toISOString().split("T")[0];const yesterday=new Date(Date.now()-86400000).toISOString().split("T")[0];
          currentTradeStreak=(ld===today||ld===yesterday)?ds:0;bestTradeStreak=bd;
        }
      }catch{}
      if(total===0){
        const bts=allStrats.flatMap(s=>s.backtest_results??[]);
        const avgWr=bts.length?bts.reduce((s,b)=>s+b.win_rate,0)/bts.length:0;
        const avgDD=bts.length?bts.reduce((s,b)=>s+b.max_drawdown,0)/bts.length:0;
        total=bts.reduce((s,b)=>s+b.trades_count,0);totalPnl=bts.length?bts.reduce((s,b)=>s+b.return_pct,0)/bts.length:0;
        winRate=Math.round(avgWr);maxDD=parseFloat(avgDD.toFixed(1));bestStreak=Math.floor(avgWr/15);
      }
      const monthlyReturn=realTrades.filter(t=>t.date>=Date.now()-30*86400000).reduce((s,t)=>s+(t.pnl??0),0);
      setTrades(realTrades);
      setStats({totalTrades:total,verifiedTrades,winRate,avgRR:parseFloat((winRate>50?1.5+(winRate-50)/30:0.8).toFixed(2)),consistency:calcConsistency(winRate,maxDD,total),maxDrawdown:parseFloat(maxDD.toFixed(1)),totalPnl:parseFloat(totalPnl.toFixed(2)),monthlyReturn:parseFloat(monthlyReturn.toFixed(2)),bestStreak,currentWinStreak,currentTradeStreak,bestTradeStreak,joinDate:allStrats[0]?.created_at??new Date().toISOString(),equityCurve});
      setStrategies(allStrats);
    }catch{setNotFound(true);}
    finally{setLoading(false);}
  };

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",gap:12,color:"#3a4a6a",fontSize:14}}>
      <span style={{display:"inline-block",width:18,height:18,border:"2px solid #1a2540",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      Loading profile…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(notFound||!stats)return(
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:48}}>👤</div>
      <div style={{fontSize:20,fontWeight:800,color:"#f0f4ff"}}>Trader not found</div>
      <div style={{fontSize:13,color:"#3a4a6a"}}>@{username} hasn&apos;t published any strategies yet</div>
      <a href="/leaderboard" style={{padding:"9px 20px",borderRadius:10,background:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.2)",color:"#38bdf8",fontSize:12,fontWeight:700,textDecoration:"none"}}>Browse Leaderboard</a>
    </div>
  );

  const rank=getRank(stats);
  const badges=getBadges(stats,strategies);
  const totalFollowers=Object.values(followerCounts).reduce((s,n)=>s+n,0);
  const monthlyRevenue=strategies.reduce((sum,s)=>sum+(followerCounts[s.id]??0)*(s.monthly_price??0),0);
  const avatarColor=["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b"][username.charCodeAt(0)%5];
  const isOwn=currentUser===username;
  const recentTrades=[...trades].sort((a,b)=>b.date-a.date).slice(0,15);
  const wins=trades.filter(t=>(t.pnl??0)>0);
  const losses=trades.filter(t=>(t.pnl??0)<0);
  const avgWin=wins.length?wins.reduce((s,t)=>s+(t.pnl??0),0)/wins.length:0;
  const avgLoss=losses.length?Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0)/losses.length):0;
  const profitFactor=avgLoss>0?(avgWin*wins.length)/(avgLoss*losses.length):wins.length>0?999:0;
  const RANKS=["Beginner","Active Trader","Consistent","Verified Trader","Funded Trader"];
  const TABS=[{id:"overview",label:"Overview"},{id:"trades",label:`Trades (${trades.length})`},{id:"strategies",label:`Strategies (${strategies.length})`},{id:"analytics",label:"Analytics"}];

  return(
    <div style={{minHeight:"100vh",background:"#060d1a",color:"#c8d8f0",fontFamily:"system-ui,sans-serif"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        .stat-card:hover{border-color:#1e3050!important;transform:translateY(-1px);transition:all 0.15s}
      `}</style>

      {/* ── Nav ── */}
      <div style={{borderBottom:"1px solid #0d1628",background:"rgba(6,13,26,0.97)",padding:"14px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)"}}>
        <a href="/traders" style={{fontSize:12,color:"#3a4a6a",textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>← Traders</a>
        <div style={{flex:1}}/>
        <button onClick={handleShare} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #1a2540",background:"#0b1120",color:shareDone?"#34d399":"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",transition:"color 0.2s"}}>
          {shareDone?"✓ Copied link":"🔗 Share"}
        </button>
        <a href="/dashboard" style={{padding:"6px 14px",borderRadius:8,border:"1px solid #1a2540",background:"#0b1120",color:"#4a5a7a",fontSize:11,fontWeight:600,textDecoration:"none"}}>Dashboard</a>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"28px 20px",animation:"fadeIn 0.4s ease"}}>

        {/* ── PROFILE HEADER ── */}
        <div style={{background:"linear-gradient(135deg,#0d1628 0%,#0f1e32 100%)",border:"1px solid #1a2540",borderRadius:24,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-50,right:-50,width:220,height:220,borderRadius:"50%",background:`${avatarColor}07`,pointerEvents:"none"}}/>
          <div style={{position:"absolute",bottom:-30,left:60,width:140,height:140,borderRadius:"50%",background:"rgba(56,189,248,0.04)",pointerEvents:"none"}}/>

          <div style={{display:"flex",alignItems:"flex-start",gap:24,flexWrap:"wrap",position:"relative"}}>
            {/* Avatar */}
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:88,height:88,borderRadius:22,background:`${avatarColor}20`,border:`2px solid ${avatarColor}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:avatarColor,fontFamily:"monospace",boxShadow:`0 0 32px ${avatarColor}18`}}>
                {username.slice(0,2).toUpperCase()}
              </div>
              {stats.verifiedTrades>=50&&(
                <div title="Verified Funded Trader" style={{position:"absolute",bottom:-5,right:-5,width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#f59e0b,#fbbf24)",border:"2px solid #060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#000"}}>✓</div>
              )}
            </div>

            {/* Identity */}
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
                <h1 style={{fontSize:24,fontWeight:900,color:"#f0f4ff",margin:0,letterSpacing:"-0.02em"}}>@{username}</h1>
                <span style={{fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:20,background:`${rank.color}18`,border:`1px solid ${rank.color}40`,color:rank.color}}>{rank.label}</span>
                {stats.verifiedTrades>=50&&<span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)",color:"#f59e0b"}}>✅ Verified Funded</span>}
              </div>
              <div style={{fontSize:12,color:"#3a4a6a",marginBottom:14,lineHeight:1.7}}>
                Member since {new Date(stats.joinDate).toLocaleDateString("en-US",{month:"long",year:"numeric"})}
                {" · "}{strategies.length} strateg{strategies.length!==1?"ies":"y"}
                {totalFollowers>0&&` · ${totalFollowers} strategy followers`}
                {followerCount>0&&` · ${followerCount} followers`}
              </div>

              {/* Action buttons */}
              {!isOwn&&currentUser&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={toggleFollow} disabled={followLoading} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:700,cursor:followLoading?"not-allowed":"pointer",transition:"all 0.15s",border:`1px solid ${isFollowing?"rgba(248,113,113,0.35)":"rgba(56,189,248,0.35)"}`,background:isFollowing?"rgba(248,113,113,0.08)":"rgba(56,189,248,0.08)",color:isFollowing?"#f87171":"#38bdf8"}}>
                    {followLoading?"…":isFollowing?"✓ Following":"+ Follow"}
                  </button>
                  <button onClick={handleCopy} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 20px",borderRadius:10,fontSize:12,fontWeight:800,cursor:"pointer",border:"none",background:copied?"rgba(52,211,153,0.15)":"linear-gradient(135deg,#0369a1,#38bdf8)",color:copied?"#34d399":"#fff",transition:"all 0.2s",boxShadow:copied?"none":"0 0 20px rgba(56,189,248,0.2)"}}>
                    {copied?"✓ Copying Trades":"📋 Copy Trader"}
                  </button>
                </div>
              )}

              {/* Rank progress */}
              {rank.progress<100&&(
                <div style={{marginTop:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:10,color:"#3a4a6a"}}>Progress to {rank.next}</span>
                    <span style={{fontSize:10,color:rank.color,fontWeight:700}}>{Math.round(rank.progress)}%</span>
                  </div>
                  <div style={{height:4,borderRadius:2,background:"#111d30",overflow:"hidden"}}>
                    <div style={{width:`${rank.progress}%`,height:"100%",background:`linear-gradient(90deg,${rank.color}66,${rank.color})`,borderRadius:2,transition:"width 0.8s"}}/>
                  </div>
                </div>
              )}
            </div>

            {/* Revenue badge */}
            {monthlyRevenue>0&&(
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:9,color:"#3a4a6a",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>Est. Monthly</div>
                <div style={{fontSize:26,fontWeight:900,color:"#22d3a5",fontFamily:"monospace"}}>${monthlyRevenue.toFixed(0)}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:20}}>
          <StatCard label="Win Rate"      value={`${stats.winRate}%`}      color={stats.winRate>=55?"#34d399":stats.winRate>=45?"#fbbf24":"#f87171"}/>
          <StatCard label="Consistency"   value={String(stats.consistency)} color={stats.consistency>=70?"#38bdf8":"#94a3b8"}/>
          <StatCard label="Avg RR"        value={String(stats.avgRR)}       color={stats.avgRR>=1.5?"#34d399":"#94a3b8"}/>
          <StatCard label="Max Drawdown"  value={`${stats.maxDrawdown}%`}   color={stats.maxDrawdown<15?"#34d399":stats.maxDrawdown<25?"#fbbf24":"#f87171"}/>
          <StatCard label="Total PnL"     value={`${stats.totalPnl>=0?"+":""}${stats.totalPnl.toFixed(0)}`} color={stats.totalPnl>=0?"#34d399":"#f87171"}/>
          <StatCard label="30-Day Return" value={`${stats.monthlyReturn>=0?"+":""}${stats.monthlyReturn.toFixed(0)}`} color={stats.monthlyReturn>=0?"#34d399":"#f87171"} sub="last 30 days"/>
          <StatCard label="Trades"        value={String(stats.totalTrades)} color="#94a3b8"/>
          <StatCard label="Followers"     value={String(followerCount)}     color="#38bdf8"/>
        </div>

        {/* ── TABS ── */}
        <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid #1a2540"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as any)} style={{padding:"10px 20px",border:"none",borderBottom:tab===t.id?"2px solid #38bdf8":"2px solid transparent",marginBottom:-1,background:"transparent",fontSize:12,fontWeight:600,cursor:"pointer",color:tab===t.id?"#38bdf8":"#475569",transition:"all 0.15s",whiteSpace:"nowrap"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeIn 0.25s ease"}}>

            {/* Equity Curve */}
            {stats.equityCurve.length>2&&(
              <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:20,padding:"20px 22px"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",marginBottom:4}}>📈 Equity Curve</div>
                <div style={{fontSize:11,color:"#3a4a6a",marginBottom:16}}>Cumulative PnL over {trades.length} trades</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.equityCurve} margin={{top:5,right:5,left:-20,bottom:0}}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#34d399" stopOpacity={0.18}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{fontSize:9,fill:"#3a4a6a"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{fontSize:9,fill:"#3a4a6a"}} tickLine={false} axisLine={false} tickFormatter={v=>`${v>=0?"+":""}${(v as number).toFixed(0)}`}/>
                    <Tooltip content={<EquityTooltip/>}/>
                    <ReferenceLine y={0} stroke="#1a2540" strokeDasharray="4 4"/>
                    <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#eqGrad)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Badges */}
            {badges.length>0&&(
              <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:20,padding:"20px 22px"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",marginBottom:14}}>Achievement Badges</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {badges.map(b=>(
                    <div key={b.id} title={b.desc} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:12,background:`${b.color}10`,border:`1px solid ${b.color}30`,cursor:"default"}}>
                      <span style={{fontSize:16}}>{b.icon}</span>
                      <span style={{fontSize:12,fontWeight:700,color:b.color}}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Streaks */}
            <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:20,padding:"20px 22px"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",marginBottom:16}}>🔥 Streaks</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                {[
                  {label:"Current Win",  val:stats.currentWinStreak,  color:stats.currentWinStreak>=5?"#f97316":stats.currentWinStreak>=3?"#34d399":"#3a4a6a",emoji:stats.currentWinStreak>=10?"🔥":stats.currentWinStreak>=5?"⚡":stats.currentWinStreak>=3?"📈":"➖"},
                  {label:"Best Win",     val:stats.bestStreak,         color:"#fbbf24",emoji:"🏆"},
                  {label:"Daily Trade",  val:stats.currentTradeStreak, color:stats.currentTradeStreak>=7?"#38bdf8":"#64748b",emoji:"📅"},
                  {label:"Best Daily",   val:stats.bestTradeStreak,    color:"#a78bfa",emoji:"⭐"},
                ].map((s,i)=>(
                  <div key={i} style={{background:"#0d1628",border:"1px solid #1a2540",borderRadius:14,padding:"14px",textAlign:"center"}}>
                    <div style={{fontSize:24,marginBottom:6}}>{s.emoji}</div>
                    <div style={{fontSize:28,fontWeight:900,fontFamily:"monospace",color:s.color,lineHeight:1}}>{s.val}</div>
                    <div style={{fontSize:10,color:"#3a4a6a",marginTop:6,fontWeight:600}}>{s.label} Streak</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rank Progression */}
            <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:20,padding:"20px 22px"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",marginBottom:16}}>Rank Progression</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  {label:"Beginner",        req:"Start trading",                   color:"#64748b"},
                  {label:"Active Trader",   req:"20+ trades",                      color:"#38bdf8"},
                  {label:"Consistent",      req:"50+ trades · 50%+ WR",            color:"#34d399"},
                  {label:"Verified Trader", req:"100+ trades · 55%+ WR · 70+ score",color:"#a78bfa"},
                  {label:"Funded Trader",   req:"200+ trades · 60%+ WR · 80+ score",color:"#f59e0b"},
                ].map((r,i)=>{
                  const active=rank.label===r.label;
                  const past=RANKS.indexOf(r.label)<RANKS.indexOf(rank.label);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,background:active?`${r.color}10`:"transparent",border:`1px solid ${active?r.color+"40":"#1a2540"}`}}>
                      <div style={{width:20,height:20,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,background:active||past?`${r.color}20`:"#111d30",border:`1px solid ${active||past?r.color:"#1e2f4a"}`,color:active||past?r.color:"#2e3f5a"}}>
                        {past?"✓":active?"●":"○"}
                      </div>
                      <div style={{flex:1}}>
                        <span style={{fontSize:12,fontWeight:active?800:600,color:active?r.color:past?"#c8d8f0":"#3a4a6a"}}>{r.label}</span>
                        <span style={{fontSize:10,color:"#2e3f5a",marginLeft:8}}>{r.req}</span>
                      </div>
                      {active&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:`${r.color}18`,color:r.color}}>Current</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ TRADES TAB ═══════════════ */}
        {tab==="trades"&&(
          <div style={{animation:"fadeIn 0.25s ease"}}>
            {recentTrades.length===0?(
              <div style={{padding:"64px",textAlign:"center",color:"#3a4a6a",fontSize:12,background:"#0b1120",border:"1px solid #1a2540",borderRadius:20}}>
                <div style={{fontSize:36,marginBottom:12}}>📭</div>
                No trades visible on this profile yet
              </div>
            ):(
              <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:20,overflow:"hidden"}}>
                <div style={{padding:"16px 20px",borderBottom:"1px solid #111827",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#94a3b8"}}>Recent Trades</span>
                  <span style={{fontSize:11,color:"#3a4a6a"}}>{trades.length} total</span>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"rgba(10,15,30,0.98)"}}>
                        {["Pair","Direction","Entry","Exit","PnL","Strategy","Date"].map(h=>(
                          <th key={h} style={{padding:"9px 14px",textAlign:"left",fontSize:9,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid rgba(30,41,59,0.8)",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map(t=>{
                        const pos=(t.pnl??0)>=0;
                        return(
                          <tr key={t.id} style={{borderBottom:"1px solid rgba(30,41,59,0.4)"}}>
                            <td style={{padding:"9px 14px",fontSize:11,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace"}}>{t.pair}</td>
                            <td style={{padding:"9px 14px"}}>
                              <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.type==="long"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",color:t.type==="long"?"#34d399":"#f87171",border:`1px solid ${t.type==="long"?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`}}>
                                {t.type==="long"?"▲ LONG":"▼ SHORT"}
                              </span>
                            </td>
                            <td style={{padding:"9px 14px",fontSize:11,color:"#64748b",fontFamily:"monospace"}}>{t.entryPrice?.toFixed(2)??"-"}</td>
                            <td style={{padding:"9px 14px",fontSize:11,color:"#64748b",fontFamily:"monospace"}}>{t.exitPrice?.toFixed(2)??"-"}</td>
                            <td style={{padding:"9px 14px",fontSize:12,fontWeight:700,color:pos?"#34d399":"#f87171",fontFamily:"monospace"}}>{pos?"+":""}{(t.pnl??0).toFixed(2)}</td>
                            <td style={{padding:"9px 14px",fontSize:11,color:"#475569"}}>{t.strategy||"—"}</td>
                            <td style={{padding:"9px 14px",fontSize:11,color:"#3a4a6a"}}>{new Date(t.date).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ STRATEGIES TAB ═══════════════ */}
        {tab==="strategies"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,animation:"fadeIn 0.25s ease"}}>
            {strategies.length===0?(
              <div style={{padding:"64px",textAlign:"center",color:"#3a4a6a",fontSize:12,background:"#0b1120",border:"1px solid #1a2540",borderRadius:20}}>
                <div style={{fontSize:36,marginBottom:12}}>📭</div>No published strategies yet
              </div>
            ):strategies.map(s=>{
              const bt=s.backtest_results?.[0];
              const pos=(bt?.return_pct??0)>=0;
              const fc=followerCounts[s.id]??0;
              const sc:Record<string,string>={verified:"#a78bfa",live:"#34d399",backtested:"#38bdf8"};
              const c=sc[s.status]??"#38bdf8";
              return(
                <div key={s.id} style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:180}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{s.name}</span>
                      <span style={{fontSize:9,padding:"2px 8px",borderRadius:10,background:`${c}15`,color:c,border:`1px solid ${c}28`,fontWeight:700}}>{s.status}</span>
                    </div>
                    {bt&&<div style={{display:"flex",gap:14,fontSize:11,color:"#3a4a6a"}}>
                      <span style={{color:pos?"#34d399":"#f87171",fontWeight:700}}>{pos?"+":""}{bt.return_pct.toFixed(1)}%</span>
                      <span>{bt.win_rate.toFixed(0)}% WR</span>
                      <span>{bt.trades_count} trades</span>
                      <span>{bt.max_drawdown.toFixed(1)}% DD</span>
                    </div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
                    {fc>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#3a4a6a"}}>Followers</div><div style={{fontSize:15,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>{fc}</div></div>}
                    {(s.monthly_price??0)>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#3a4a6a"}}>Price</div><div style={{fontSize:15,fontWeight:700,color:"#fbbf24",fontFamily:"monospace"}}>${s.monthly_price}/mo</div></div>}
                    <a href="/leaderboard" style={{padding:"7px 16px",borderRadius:9,background:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.2)",color:"#38bdf8",fontSize:11,fontWeight:700,textDecoration:"none"}}>View →</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
        {tab==="analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeIn 0.25s ease"}}>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
              <StatCard label="Avg Winner"      value={`+${avgWin.toFixed(2)}`}        color="#34d399"/>
              <StatCard label="Avg Loser"       value={`-${avgLoss.toFixed(2)}`}        color="#f87171"/>
              <StatCard label="Profit Factor"   value={profitFactor>=999?"∞":profitFactor.toFixed(2)} color={profitFactor>=1.5?"#34d399":profitFactor>=1?"#fbbf24":"#f87171"}/>
              <StatCard label="Best Trade"      value={wins.length?`+${Math.max(...wins.map(t=>t.pnl??0)).toFixed(2)}`:"—"} color="#34d399"/>
              <StatCard label="Worst Trade"     value={losses.length?`${Math.min(...losses.map(t=>t.pnl??0)).toFixed(2)}`:"—"} color="#f87171"/>
              <StatCard label="Total Wins"      value={String(wins.length)}             color="#34d399"/>
              <StatCard label="Total Losses"    value={String(losses.length)}           color="#f87171"/>
              <StatCard label="Verified Trades" value={String(stats.verifiedTrades)}    color="#f59e0b" sub="broker imports"/>
            </div>

            {/* Win/Loss bar */}
            {trades.length>0&&(
              <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:16,padding:"18px 22px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:12}}>Win / Loss Split</div>
                <div style={{height:10,borderRadius:5,overflow:"hidden",display:"flex"}}>
                  <div style={{width:`${stats.winRate}%`,background:"linear-gradient(90deg,#0ea5a0,#34d399)",transition:"width 0.8s"}}/>
                  <div style={{flex:1,background:"linear-gradient(90deg,#ef4444,#f87171)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                  <span style={{fontSize:11,color:"#34d399",fontWeight:700}}>{stats.winRate}% wins ({wins.length})</span>
                  <span style={{fontSize:11,color:"#f87171",fontWeight:700}}>{100-stats.winRate}% losses ({losses.length})</span>
                </div>
              </div>
            )}

            {/* PnL chart */}
            {stats.equityCurve.length>2&&(
              <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:16,padding:"18px 22px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:16}}>Cumulative PnL</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats.equityCurve} margin={{top:5,right:5,left:-20,bottom:0}}>
                    <XAxis dataKey="label" tick={{fontSize:9,fill:"#3a4a6a"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{fontSize:9,fill:"#3a4a6a"}} tickLine={false} axisLine={false} tickFormatter={v=>`${(v as number)>=0?"+":""}${(v as number).toFixed(0)}`}/>
                    <Tooltip content={<EquityTooltip/>}/>
                    <ReferenceLine y={0} stroke="#1a2540" strokeDasharray="4 4"/>
                    <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{r:4,fill:"#38bdf8"}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}