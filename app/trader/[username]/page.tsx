"use client";
import FollowButton from "@/components/FollowButton";

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
interface PostRow {
  id:string; symbol:string; side:"long"|"short"; pnl:number|null;
  notes:string|null; setup_name:string|null; created_at:string;
  likes_count:number; comments_count:number;
}
function timeAgo(iso:string){
  const d=Date.now()-new Date(iso).getTime();
  const m=Math.floor(d/60000),h=Math.floor(d/3600000),dd=Math.floor(d/86400000);
  if(m<1)return"just now";
  if(m<60)return`${m}m ago`;
  if(h<24)return`${h}h ago`;
  return`${dd}d ago`;
}
function getRank(s:ProfileStats) {
  if(s.totalTrades>=200&&s.winRate>=60&&s.consistency>=80) return{label:"Funded Trader",  color:"#f59e0b",next:"Max rank",          progress:100};
  if(s.totalTrades>=100&&s.winRate>=55&&s.consistency>=70) return{label:"Verified Trader",color:"#a5b4fc",next:"Funded Trader",      progress:Math.min(100,((s.totalTrades-100)/100)*100)};
  if(s.totalTrades>=50 &&s.winRate>=50&&s.consistency>=55) return{label:"Consistent",     color:"#10b981",next:"Verified Trader",    progress:Math.min(100,((s.totalTrades-50)/50)*100)};
  if(s.totalTrades>=20)                                    return{label:"Active Trader",  color:"#6366f1",next:"Consistent",         progress:Math.min(100,((s.totalTrades-20)/30)*100)};
  return                                                         {label:"Beginner",        color:"#6b7280",next:"Active Trader",      progress:Math.min(100,(s.totalTrades/20)*100)};
}
function getBadges(s:ProfileStats,strats:Strategy[]):Badge[] {
  const b:Badge[]=[];
  if(s.winRate>=60)         b.push({id:"wr",   label:"Sharp Shooter",  icon:"",color:"#10b981",desc:"60%+ win rate"});
  if(s.consistency>=75)     b.push({id:"con",  label:"Consistent",     icon:"",color:"#6366f1",desc:"75+ score"});
  if(s.totalTrades>=100)    b.push({id:"100",  label:"Centurion",      icon:"",color:"#a5b4fc",desc:"100+ trades"});
  if(s.maxDrawdown<10)      b.push({id:"dd",   label:"Risk Master",    icon:"️",color:"#22d3a5",desc:"DD under 10%"});
  if(s.bestStreak>=5)       b.push({id:"str",  label:"On Fire",        icon:"",color:"#f59e0b",desc:"5+ win streak"});
  if(s.totalPnl>0)          b.push({id:"pnl",  label:"In The Green",   icon:"",color:"#10b981",desc:"Positive PnL"});
  if(s.verifiedTrades>=50)  b.push({id:"ver",  label:"Verified Funded",icon:"",color:"#f59e0b",desc:"50+ broker trades"});
  if(strats.some(x=>x.status==="verified")) b.push({id:"vs",label:"Verified Strategy",icon:"✓",color:"#a5b4fc",desc:"Verified strategy"});
  if(strats.some(x=>(x.monthly_price??0)>0))b.push({id:"earn",label:"Earning",icon:"",color:"#f59e0b",desc:"Paid subscribers"});
  return b;
}
function calcConsistency(wr:number,dd:number,total:number){
  if(total<5)return 0;
  return Math.round(Math.min(100,wr*1.4)*0.5+Math.max(0,100-dd*3)*0.3+Math.min(100,total/2)*0.2);
}

// ── Small Components ───────────────────────────────────────────
function StatCard({label,value,color,sub}:{label:string;value:string;color?:string;sub?:string}){
  return(
    <div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:14,padding:"16px",textAlign:"center",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-15,right:-15,width:50,height:50,borderRadius:"50%",background:`${color??"#6366f1"}08`,pointerEvents:"none"}}/><div style={{fontSize:9,fontWeight:700,color:"#2a2a3a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{label}</div><div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:color??"#ffffff",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:"#2a2a3a",marginTop:5}}>{sub}</div>}
    </div>
  );
}
function EquityTooltip({active,payload,label}:any){
  if(!active||!payload?.length)return null;
  const v=payload[0].value as number;
  return(
    <div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:10,padding:"10px 14px",fontSize:11}}><div style={{color:"#6b7280",marginBottom:4}}>{label}</div><div style={{color:v>=0?"#10b981":"#ef4444",fontWeight:700,fontFamily:"monospace"}}>{v>=0?"+":""}{v.toFixed(2)}</div></div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TraderProfile(){
  const params=useParams();
  const username=decodeURIComponent((params?.username as string)??"").replace(/^@/,"");

  const [tab,setTab]=useState<"overview"|"posts"|"trades"|"strategies"|"analytics">("overview");
 const [strategies,setStrategies]=useState<Strategy[]>([]);
 const [trades,setTrades]=useState<Trade[]>([]);
 const [posts,setPosts]=useState<PostRow[]>([]);
 const [postsLoading,setPostsLoading]=useState(true);
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
    loadPosts();
    try{const s=JSON.parse(localStorage.getItem("tradedesk_session_v1")??"{}");setCurrentUser(s.username??"");}catch{}
  },[username]);

  const loadPosts=async()=>{
    setPostsLoading(true);
    try{
      const SUPA="https://xsrcaceydyqytbipvrok.supabase.co";
      const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";
      const pr=await fetch(`${SUPA}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id`,{headers:{apikey:KEY,Authorization:"Bearer "+KEY}});
      const pj=await pr.json();
      if(!Array.isArray(pj)||!pj.length){setPosts([]);return;}
      const uid=pj[0].id;
      const tr=await fetch(`${SUPA}/rest/v1/trade_posts?user_id=eq.${encodeURIComponent(uid)}&visibility=eq.public&order=created_at.desc&select=id,symbol,side,pnl,notes,setup_name,created_at,likes_count,comments_count`,{headers:{apikey:KEY,Authorization:"Bearer "+KEY}});
      const tj=await tr.json();
      setPosts(Array.isArray(tj)?tj as PostRow[]:[]);
    }catch{setPosts([]);}
    finally{setPostsLoading(false);}
  };

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
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",gap:12,color:"#2a2a3a",fontSize:14}}><span style={{display:"inline-block",width:18,height:18,border:"2px solid #2a2a3a",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Loading profile…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);

 if(notFound||!stats)return(<div style={{minHeight:"100vh",background:"#060d1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{fontSize:48}}></div><div style={{fontSize:20,fontWeight:800,color:"#ffffff"}}>Trader not found</div><div style={{fontSize:13,color:"#2a2a3a"}}>@{username} hasn&apos;t published any strategies yet</div><a href="/leaderboard" style={{padding:"9px 20px",borderRadius:10,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",color:"#6366f1",fontSize:12,fontWeight:700,textDecoration:"none"}}>Browse Leaderboard</a></div>
  );

  const rank=getRank(stats);
  const badges=getBadges(stats,strategies);
  const totalFollowers=Object.values(followerCounts).reduce((s,n)=>s+n,0);
  const monthlyRevenue=strategies.reduce((sum,s)=>sum+(followerCounts[s.id]??0)*(s.monthly_price??0),0);
  const avatarColor=["#6366f1","#a5b4fc","#10b981","#f59e0b","#f59e0b"][username.charCodeAt(0)%5];
  const isOwn=currentUser===username;
  const recentTrades=[...trades].sort((a,b)=>b.date-a.date).slice(0,15);
  const wins=trades.filter(t=>(t.pnl??0)>0);
  const losses=trades.filter(t=>(t.pnl??0)<0);
  const avgWin=wins.length?wins.reduce((s,t)=>s+(t.pnl??0),0)/wins.length:0;
  const avgLoss=losses.length?Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0)/losses.length):0;
  const profitFactor=avgLoss>0?(avgWin*wins.length)/(avgLoss*losses.length):wins.length>0?999:0;
  const RANKS=["Beginner","Active Trader","Consistent","Verified Trader","Funded Trader"];
  const TABS=[{id:"overview",label:"Overview"},{id:"posts",label:`Posts (${posts.length})`},{id:"trades",label:`Trades (${trades.length})`},{id:"strategies",label:`Strategies (${strategies.length})`},{id:"analytics",label:"Analytics"}];

  return(
    <div style={{minHeight:"100vh",background:"#060d1a",color:"#c8d8f0",fontFamily:"system-ui,sans-serif"}}><style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        .stat-card:hover{border-color:#1e3050!important;transform:translateY(-1px);transition:all 0.15s}
      `}</style>

      {/* ── Nav ── */}
      <div style={{borderBottom:"1px solid #111118",background:"rgba(6,13,26,0.97)",padding:"14px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)"}}><a href="/traders" style={{fontSize:12,color:"#2a2a3a",textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>← Traders</a><div style={{flex:1}}/><button onClick={handleShare} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #2a2a3a",background:"#111118",color:shareDone?"#10b981":"#6b7280",fontSize:11,fontWeight:600,cursor:"pointer",transition:"color 0.2s"}}>
          {shareDone?"✓ Copied link":" Share"}
        </button><a href="/dashboard" style={{padding:"6px 14px",borderRadius:8,border:"1px solid #2a2a3a",background:"#111118",color:"#4a5a7a",fontSize:11,fontWeight:600,textDecoration:"none"}}>Dashboard</a></div><div style={{maxWidth:960,margin:"0 auto",padding:"28px 20px",animation:"fadeIn 0.4s ease"}}>

        {/* ── PROFILE HEADER ── */}
        <div style={{background:"linear-gradient(135deg,#111118 0%,#0f1e32 100%)",border:"1px solid #2a2a3a",borderRadius:24,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-50,right:-50,width:220,height:220,borderRadius:"50%",background:`${avatarColor}07`,pointerEvents:"none"}}/><div style={{position:"absolute",bottom:-30,left:60,width:140,height:140,borderRadius:"50%",background:"rgba(99,102,241,0.04)",pointerEvents:"none"}}/><div style={{display:"flex",alignItems:"flex-start",gap:24,flexWrap:"wrap",position:"relative"}}>
            {/* Avatar */}
            <div style={{position:"relative",flexShrink:0}}><div style={{width:88,height:88,borderRadius:22,background:`${avatarColor}20`,border:`2px solid ${avatarColor}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:avatarColor,fontFamily:"monospace",boxShadow:`0 0 32px ${avatarColor}18`}}>
                {username.slice(0,2).toUpperCase()}
              </div>
              {stats.verifiedTrades>=50&&(<div title="Verified Funded Trader" style={{position:"absolute",bottom:-5,right:-5,width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#f59e0b,#f59e0b)",border:"2px solid #060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#000"}}>✓</div>
              )}
            </div>

            {/* Identity */}
            <div style={{flex:1,minWidth:200}}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}><h1 style={{fontSize:24,fontWeight:900,color:"#ffffff",margin:0,letterSpacing:"-0.02em"}}>@{username}</h1><span style={{fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:20,background:`${rank.color}18`,border:`1px solid ${rank.color}40`,color:rank.color}}>{rank.label}</span>
                {stats.verifiedTrades>=50&&<span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)",color:"#f59e0b"}}>Verified Funded</span>}
              </div><div style={{fontSize:12,color:"#2a2a3a",marginBottom:14,lineHeight:1.7}}>
                Member since {new Date(stats.joinDate).toLocaleDateString("en-US",{month:"long",year:"numeric"})}
                {" · "}{strategies.length} strateg{strategies.length!==1?"ies":"y"}
                {totalFollowers>0&&` · ${totalFollowers} strategy followers`}
                {followerCount>0&&` · ${followerCount} followers`}
              </div>

              {/* Action buttons */}
              {!isOwn&&currentUser&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={toggleFollow} disabled={followLoading} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:700,cursor:followLoading?"not-allowed":"pointer",transition:"all 0.15s",border:`1px solid ${isFollowing?"rgba(248,113,113,0.35)":"rgba(99,102,241,0.35)"}`,background:isFollowing?"rgba(248,113,113,0.08)":"rgba(99,102,241,0.08)",color:isFollowing?"#ef4444":"#6366f1"}}>
                    {followLoading?"…":isFollowing?"✓ Following":"+ Follow"}
                  </button><button onClick={handleCopy} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 20px",borderRadius:10,fontSize:12,fontWeight:800,cursor:"pointer",border:"none",background:copied?"rgba(52,211,153,0.15)":"#6366f1",color:copied?"#10b981":"#fff",transition:"all 0.2s",boxShadow:copied?"none":"0 0 20px rgba(99,102,241,0.2)"}}>
                    {copied?"✓ Copying Trades":" Copy Trader"}
                  </button></div>
              )}

              {/* Rank progress */}
              {rank.progress<100&&(
                <div style={{marginTop:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:10,color:"#2a2a3a"}}>Progress to {rank.next}</span><span style={{fontSize:10,color:rank.color,fontWeight:700}}>{Math.round(rank.progress)}%</span></div><div style={{height:4,borderRadius:2,background:"#111118",overflow:"hidden"}}><div style={{width:`${rank.progress}%`,height:"100%",background:`linear-gradient(90deg,${rank.color}66,${rank.color})`,borderRadius:2,transition:"width 0.8s"}}/></div></div>
              )}
            </div>

            {/* Revenue badge */}
            {monthlyRevenue>0&&(<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:9,color:"#2a2a3a",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>Est. Monthly</div><div style={{fontSize:26,fontWeight:900,color:"#22d3a5",fontFamily:"monospace"}}>${monthlyRevenue.toFixed(0)}</div></div>
            )}
          </div></div>

        {/* ── STAT CARDS ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:20}}><StatCard label="Win Rate"      value={`${stats.winRate}%`}      color={stats.winRate>=55?"#10b981":stats.winRate>=45?"#f59e0b":"#ef4444"}/><StatCard label="Consistency"   value={String(stats.consistency)} color={stats.consistency>=70?"#6366f1":"#9ca3af"}/><StatCard label="Avg RR"        value={String(stats.avgRR)}       color={stats.avgRR>=1.5?"#10b981":"#9ca3af"}/><StatCard label="Max Drawdown"  value={`${stats.maxDrawdown}%`}   color={stats.maxDrawdown<15?"#10b981":stats.maxDrawdown<25?"#f59e0b":"#ef4444"}/><StatCard label="Total PnL"     value={`${stats.totalPnl>=0?"+":""}${stats.totalPnl.toFixed(0)}`} color={stats.totalPnl>=0?"#10b981":"#ef4444"}/><StatCard label="30-Day Return" value={`${stats.monthlyReturn>=0?"+":""}${stats.monthlyReturn.toFixed(0)}`} color={stats.monthlyReturn>=0?"#10b981":"#ef4444"} sub="last 30 days"/><StatCard label="Trades"        value={String(stats.totalTrades)} color="#9ca3af"/><StatCard label="Followers"     value={String(followerCount)}     color="#6366f1"/></div>

        {/* ── TABS ── */}
        <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid #2a2a3a"}}>
          {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id as any)} style={{padding:"10px 20px",border:"none",borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent",marginBottom:-1,background:"transparent",fontSize:12,fontWeight:600,cursor:"pointer",color:tab===t.id?"#6366f1":"#6b7280",transition:"all 0.15s",whiteSpace:"nowrap"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeIn 0.25s ease"}}>

            {/* Equity Curve */}
            {stats.equityCurve.length>2&&(<div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:20,padding:"20px 22px"}}><div style={{fontSize:13,fontWeight:800,color:"#ffffff",marginBottom:4}}>Equity Curve</div><div style={{fontSize:11,color:"#2a2a3a",marginBottom:16}}>Cumulative PnL over {trades.length} trades</div><ResponsiveContainer width="100%" height={200}><AreaChart data={stats.equityCurve} margin={{top:5,right:5,left:-20,bottom:0}}><defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#10b981" stopOpacity={0.18}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="label" tick={{fontSize:9,fill:"#2a2a3a"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/><YAxis tick={{fontSize:9,fill:"#2a2a3a"}} tickLine={false} axisLine={false} tickFormatter={v=>`${v>=0?"+":""}${(v as number).toFixed(0)}`}/><Tooltip content={<EquityTooltip/>}/><ReferenceLine y={0} stroke="#2a2a3a" strokeDasharray="4 4"/><Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#eqGrad)" dot={false}/></AreaChart></ResponsiveContainer></div>
            )}

            {/* Badges */}
            {badges.length>0&&(<div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:20,padding:"20px 22px"}}><div style={{fontSize:13,fontWeight:800,color:"#ffffff",marginBottom:14}}>Achievement Badges</div><div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {badges.map(b=>(<div key={b.id} title={b.desc} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:12,background:`${b.color}10`,border:`1px solid ${b.color}30`,cursor:"default"}}><span style={{fontSize:16}}>{b.icon}</span><span style={{fontSize:12,fontWeight:700,color:b.color}}>{b.label}</span></div>
                  ))}
                </div></div>
            )}

            {/* Streaks */}
            <div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:20,padding:"20px 22px"}}><div style={{fontSize:13,fontWeight:800,color:"#ffffff",marginBottom:16}}>Streaks</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                {[
                  {label:"Current Win",  val:stats.currentWinStreak,  color:stats.currentWinStreak>=5?"#f59e0b":stats.currentWinStreak>=3?"#10b981":"#2a2a3a",emoji:stats.currentWinStreak>=10?"":stats.currentWinStreak>=5?"":stats.currentWinStreak>=3?"":""},
                  {label:"Best Win",     val:stats.bestStreak,         color:"#f59e0b",emoji:""},
                  {label:"Daily Trade",  val:stats.currentTradeStreak, color:stats.currentTradeStreak>=7?"#6366f1":"#6b7280",emoji:""},
                  {label:"Best Daily",   val:stats.bestTradeStreak,    color:"#a5b4fc",emoji:"⭐"},
                ].map((s,i)=>(<div key={i} style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:14,padding:"14px",textAlign:"center"}}><div style={{fontSize:24,marginBottom:6}}>{s.emoji}</div><div style={{fontSize:28,fontWeight:900,fontFamily:"monospace",color:s.color,lineHeight:1}}>{s.val}</div><div style={{fontSize:10,color:"#2a2a3a",marginTop:6,fontWeight:600}}>{s.label} Streak</div></div>
                ))}
              </div></div>

            {/* Rank Progression */}
            <div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:20,padding:"20px 22px"}}><div style={{fontSize:13,fontWeight:800,color:"#ffffff",marginBottom:16}}>Rank Progression</div><div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  {label:"Beginner",        req:"Start trading",                   color:"#6b7280"},
                  {label:"Active Trader",   req:"20+ trades",                      color:"#6366f1"},
                  {label:"Consistent",      req:"50+ trades · 50%+ WR",            color:"#10b981"},
                  {label:"Verified Trader", req:"100+ trades · 55%+ WR · 70+ score",color:"#a5b4fc"},
                  {label:"Funded Trader",   req:"200+ trades · 60%+ WR · 80+ score",color:"#f59e0b"},
                ].map((r,i)=>{
                  const active=rank.label===r.label;
                  const past=RANKS.indexOf(r.label)<RANKS.indexOf(rank.label);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,background:active?`${r.color}10`:"transparent",border:`1px solid ${active?r.color+"40":"#2a2a3a"}`}}><div style={{width:20,height:20,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,background:active||past?`${r.color}20`:"#111118",border:`1px solid ${active||past?r.color:"#1e2f4a"}`,color:active||past?r.color:"#2e3f5a"}}>
                        {past?"✓":active?"●":"○"}
                      </div><div style={{flex:1}}><span style={{fontSize:12,fontWeight:active?800:600,color:active?r.color:past?"#c8d8f0":"#2a2a3a"}}>{r.label}</span><span style={{fontSize:10,color:"#2e3f5a",marginLeft:8}}>{r.req}</span></div>
                      {active&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:`${r.color}18`,color:r.color}}>Current</span>}
                    </div>
                  );
                })}
              </div></div></div>
        )}

        {/* ═══════════════ POSTS TAB ═══════════════ */}
        {tab==="posts"&&(
          <div style={{animation:"fadeIn 0.25s ease"}}>
            {postsLoading?(
              <div style={{padding:60,textAlign:"center",color:"#2a2a3a",fontSize:12}}><div style={{width:24,height:24,border:"2px solid #2a2a3a",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"0 auto 12px"}}/>Loading posts…</div>):posts.length===0?(<div style={{padding:"64px",textAlign:"center",color:"#2a2a3a",fontSize:12,background:"#111118",border:"1px solid #2a2a3a",borderRadius:20}}><div style={{fontSize:36,marginBottom:12}}></div>
                @{username} hasn&apos;t shared any trades yet
              </div>):(<div style={{display:"flex",flexDirection:"column",gap:12}}>
                {posts.map(p=>{
                  const pos=(p.pnl??0)>=0;
 return(<div key={p.id} style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:18,padding:"16px 20px"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}><span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,background:p.side==="long"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",color:p.side==="long"?"#10b981":"#ef4444"}}>
                          {p.side==="long"?"▲ LONG":"▼ SHORT"}
                        </span><span style={{fontSize:12,fontWeight:700,color:"#ffffff",fontFamily:"monospace"}}>{p.symbol}</span>
                        {p.setup_name&&<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:4,background:"rgba(99,102,241,0.1)",color:"#a5b4fc",border:"1px solid rgba(99,102,241,0.2)"}}>{p.setup_name}</span>}
                        <span style={{flex:1}}/><span style={{fontSize:11,color:"#2e3f5a"}}>{timeAgo(p.created_at)}</span></div>
                      {p.pnl!==null&&(
                        <div style={{display:"inline-flex",padding:"6px 12px",borderRadius:10,background:pos?"rgba(52,211,153,0.08)":"rgba(248,113,113,0.08)",border:`1px solid ${pos?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`,marginBottom:8}}><span style={{fontSize:18,fontWeight:900,color:pos?"#10b981":"#ef4444",fontFamily:"monospace"}}>{pos?"+":""}{(p.pnl??0).toFixed(2)}</span></div>
                      )}
                      {p.notes&&<p style={{fontSize:12,color:"#6b7280",margin:"4px 0 8px",lineHeight:1.6,fontStyle:"italic"}}>&ldquo;{p.notes}&rdquo;</p>}
                      <div style={{display:"flex",alignItems:"center",gap:16,marginTop:6,fontSize:11,color:"#2a2a3a"}}><span>️ {p.likes_count}</span><span> {p.comments_count}</span></div></div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TRADES TAB ═══════════════ */}
        {tab==="trades"&&(
          <div style={{animation:"fadeIn 0.25s ease"}}>
            {recentTrades.length===0?(
              <div style={{padding:"64px",textAlign:"center",color:"#2a2a3a",fontSize:12,background:"#111118",border:"1px solid #2a2a3a",borderRadius:20}}><div style={{fontSize:36,marginBottom:12}}></div>No trades visible on this profile yet</div>):(<div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:20,overflow:"hidden"}}><div style={{padding:"16px 20px",borderBottom:"1px solid #1a1a24",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700,color:"#9ca3af"}}>Recent Trades</span><span style={{fontSize:11,color:"#2a2a3a"}}>{trades.length} total</span></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"rgba(10,15,30,0.98)"}}>
                        {["Pair","Direction","Entry","Exit","PnL","Strategy","Date"].map(h=>(<th key={h} style={{padding:"9px 14px",textAlign:"left",fontSize:9,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid rgba(30,41,59,0.8)",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead><tbody>
                      {recentTrades.map(t=>{
                        const pos=(t.pnl??0)>=0;
 return(<tr key={t.id} style={{borderBottom:"1px solid rgba(30,41,59,0.4)"}}><td style={{padding:"9px 14px",fontSize:11,fontWeight:700,color:"#ffffff",fontFamily:"monospace"}}>{t.pair}</td><td style={{padding:"9px 14px"}}><span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.type==="long"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",color:t.type==="long"?"#10b981":"#ef4444",border:`1px solid ${t.type==="long"?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`}}>
                                {t.type==="long"?"▲ LONG":"▼ SHORT"}
                              </span></td><td style={{padding:"9px 14px",fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{t.entryPrice?.toFixed(2)??"-"}</td><td style={{padding:"9px 14px",fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{t.exitPrice?.toFixed(2)??"-"}</td><td style={{padding:"9px 14px",fontSize:12,fontWeight:700,color:pos?"#10b981":"#ef4444",fontFamily:"monospace"}}>{pos?"+":""}{(t.pnl??0).toFixed(2)}</td><td style={{padding:"9px 14px",fontSize:11,color:"#6b7280"}}>{t.strategy||"—"}</td><td style={{padding:"9px 14px",fontSize:11,color:"#2a2a3a"}}>{new Date(t.date).toLocaleDateString()}</td></tr>
                        );
                      })}
                    </tbody></table></div></div>
            )}
          </div>
        )}

        {/* ═══════════════ STRATEGIES TAB ═══════════════ */}
        {tab==="strategies"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,animation:"fadeIn 0.25s ease"}}>
            {strategies.length===0?(
              <div style={{padding:"64px",textAlign:"center",color:"#2a2a3a",fontSize:12,background:"#111118",border:"1px solid #2a2a3a",borderRadius:20}}><div style={{fontSize:36,marginBottom:12}}></div>No published strategies yet</div>
            ):strategies.map(s=>{
              const bt=s.backtest_results?.[0];
              const pos=(bt?.return_pct??0)>=0;
 const fc=followerCounts[s.id]??0;
 const sc:Record<string,string>={verified:"#a5b4fc",live:"#10b981",backtested:"#6366f1"};
              const c=sc[s.status]??"#6366f1";
              return(
                <div key={s.id} style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}><div style={{flex:1,minWidth:180}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:14,fontWeight:700,color:"#ffffff"}}>{s.name}</span><span style={{fontSize:9,padding:"2px 8px",borderRadius:10,background:`${c}15`,color:c,border:`1px solid ${c}28`,fontWeight:700}}>{s.status}</span></div>
                    {bt&&<div style={{display:"flex",gap:14,fontSize:11,color:"#2a2a3a"}}><span style={{color:pos?"#10b981":"#ef4444",fontWeight:700}}>{pos?"+":""}{bt.return_pct.toFixed(1)}%</span><span>{bt.win_rate.toFixed(0)}% WR</span><span>{bt.trades_count} trades</span><span>{bt.max_drawdown.toFixed(1)}% DD</span></div>}
                  </div><div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
                    {fc>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#2a2a3a"}}>Followers</div><div style={{fontSize:15,fontWeight:700,color:"#6366f1",fontFamily:"monospace"}}>{fc}</div></div>}
                    {(s.monthly_price??0)>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#2a2a3a"}}>Price</div><div style={{fontSize:15,fontWeight:700,color:"#f59e0b",fontFamily:"monospace"}}>${s.monthly_price}/mo</div></div>}
                    <a href="/leaderboard" style={{padding:"7px 16px",borderRadius:9,background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",color:"#6366f1",fontSize:11,fontWeight:700,textDecoration:"none"}}>View →</a></div></div>
              );
            })}
          </div>
        )}

        {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
        {tab==="analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeIn 0.25s ease"}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}><StatCard label="Avg Winner"      value={`+${avgWin.toFixed(2)}`}        color="#10b981"/><StatCard label="Avg Loser"       value={`-${avgLoss.toFixed(2)}`}        color="#ef4444"/><StatCard label="Profit Factor"   value={profitFactor>=999?"∞":profitFactor.toFixed(2)} color={profitFactor>=1.5?"#10b981":profitFactor>=1?"#f59e0b":"#ef4444"}/><StatCard label="Best Trade"      value={wins.length?`+${Math.max(...wins.map(t=>t.pnl??0)).toFixed(2)}`:"—"} color="#10b981"/><StatCard label="Worst Trade"     value={losses.length?`${Math.min(...losses.map(t=>t.pnl??0)).toFixed(2)}`:"—"} color="#ef4444"/><StatCard label="Total Wins"      value={String(wins.length)}             color="#10b981"/><StatCard label="Total Losses"    value={String(losses.length)}           color="#ef4444"/><StatCard label="Verified Trades" value={String(stats.verifiedTrades)}    color="#f59e0b" sub="broker imports"/></div>

            {/* Win/Loss bar */}
            {trades.length>0&&(<div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:16,padding:"18px 22px"}}><div style={{fontSize:12,fontWeight:700,color:"#9ca3af",marginBottom:12}}>Win / Loss Split</div><div style={{height:10,borderRadius:5,overflow:"hidden",display:"flex"}}><div style={{width:`${stats.winRate}%`,background:"linear-gradient(90deg,#10b981,#10b981)",transition:"width 0.8s"}}/><div style={{flex:1,background:"linear-gradient(90deg,#ef4444,#ef4444)"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><span style={{fontSize:11,color:"#10b981",fontWeight:700}}>{stats.winRate}% wins ({wins.length})</span><span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>{100-stats.winRate}% losses ({losses.length})</span></div></div>
            )}

            {/* PnL chart */}
            {stats.equityCurve.length>2&&(<div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:16,padding:"18px 22px"}}><div style={{fontSize:12,fontWeight:700,color:"#9ca3af",marginBottom:16}}>Cumulative PnL</div><ResponsiveContainer width="100%" height={220}><LineChart data={stats.equityCurve} margin={{top:5,right:5,left:-20,bottom:0}}><XAxis dataKey="label" tick={{fontSize:9,fill:"#2a2a3a"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/><YAxis tick={{fontSize:9,fill:"#2a2a3a"}} tickLine={false} axisLine={false} tickFormatter={v=>`${(v as number)>=0?"+":""}${(v as number).toFixed(0)}`}/><Tooltip content={<EquityTooltip/>}/><ReferenceLine y={0} stroke="#2a2a3a" strokeDasharray="4 4"/><Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{r:4,fill:"#6366f1"}}/></LineChart></ResponsiveContainer></div>
            )}
          </div>
        )}

      </div></div>
  );
}