"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis,
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

  const [tab,setTab]=useState<"overview"|"trades">("overview");
  const [strategies,setStrategies]=useState<Strategy[]>([]);
  const [trades,setTrades]=useState<Trade[]>([]);
  const [stats,setStats]=useState<ProfileStats|null>(null);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  const [shareDone,setShareDone]=useState(false);

  useEffect(()=>{
    if(!username)return;
    loadProfile();
  },[username]);

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

  if(notFound||!stats)return(<div style={{minHeight:"100vh",background:"#060d1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{fontSize:48}}></div><div style={{fontSize:20,fontWeight:800,color:"#ffffff"}}>Trader not found</div><div style={{fontSize:13,color:"#2a2a3a"}}>@{username} hasn&apos;t published any strategies yet</div><a href="/dashboard" style={{padding:"9px 20px",borderRadius:10,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",color:"#6366f1",fontSize:12,fontWeight:700,textDecoration:"none"}}>Back to Dashboard</a></div>
  );

  const avatarColor=["#6366f1","#a5b4fc","#10b981","#f59e0b","#f59e0b"][username.charCodeAt(0)%5];
  const recentTrades=[...trades].sort((a,b)=>b.date-a.date).slice(0,15);
  const TABS=[{id:"overview",label:"Overview"},{id:"trades",label:`Trades (${trades.length})`}];

  return(
    <div style={{minHeight:"100vh",background:"#060d1a",color:"#c8d8f0",fontFamily:"system-ui,sans-serif"}}><style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        .stat-card:hover{border-color:#1e3050!important;transform:translateY(-1px);transition:all 0.15s}
      `}</style>

      {/* ── Nav ── */}
      <div style={{borderBottom:"1px solid #111118",background:"rgba(6,13,26,0.97)",padding:"14px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)"}}><a href="/dashboard" style={{fontSize:12,color:"#2a2a3a",textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>← Dashboard</a><div style={{flex:1}}/><button onClick={handleShare} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #2a2a3a",background:"#111118",color:shareDone?"#10b981":"#6b7280",fontSize:11,fontWeight:600,cursor:"pointer",transition:"color 0.2s"}}>
          {shareDone?"✓ Copied link":" Share"}
        </button></div><div style={{maxWidth:960,margin:"0 auto",padding:"28px 20px",animation:"fadeIn 0.4s ease"}}>

        {/* ── PROFILE HEADER ── */}
        <div style={{background:"linear-gradient(135deg,#111118 0%,#0f1e32 100%)",border:"1px solid #2a2a3a",borderRadius:24,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-50,right:-50,width:220,height:220,borderRadius:"50%",background:`${avatarColor}07`,pointerEvents:"none"}}/><div style={{position:"absolute",bottom:-30,left:60,width:140,height:140,borderRadius:"50%",background:"rgba(99,102,241,0.04)",pointerEvents:"none"}}/><div style={{display:"flex",alignItems:"flex-start",gap:24,flexWrap:"wrap",position:"relative"}}>
            {/* Avatar */}
            <div style={{position:"relative",flexShrink:0}}><div style={{width:88,height:88,borderRadius:22,background:`${avatarColor}20`,border:`2px solid ${avatarColor}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:avatarColor,fontFamily:"monospace",boxShadow:`0 0 32px ${avatarColor}18`}}>
                {username.slice(0,2).toUpperCase()}
              </div>
            </div>

            {/* Identity */}
            <div style={{flex:1,minWidth:200}}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}><h1 style={{fontSize:24,fontWeight:900,color:"#ffffff",margin:0,letterSpacing:"-0.02em"}}>@{username}</h1></div><div style={{fontSize:12,color:"#2a2a3a",marginBottom:14,lineHeight:1.7}}>
                Member since {new Date(stats.joinDate).toLocaleDateString("en-US",{month:"long",year:"numeric"})}
                {" · "}{strategies.length} strateg{strategies.length!==1?"ies":"y"}
              </div>
            </div>
          </div></div>

        {/* ── STAT CARDS ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:20}}><StatCard label="Win Rate"      value={`${stats.winRate}%`}      color={stats.winRate>=55?"#10b981":stats.winRate>=45?"#f59e0b":"#ef4444"}/><StatCard label="Consistency"   value={String(stats.consistency)} color={stats.consistency>=70?"#6366f1":"#9ca3af"}/><StatCard label="Avg RR"        value={String(stats.avgRR)}       color={stats.avgRR>=1.5?"#10b981":"#9ca3af"}/><StatCard label="Max Drawdown"  value={`${stats.maxDrawdown}%`}   color={stats.maxDrawdown<15?"#10b981":stats.maxDrawdown<25?"#f59e0b":"#ef4444"}/><StatCard label="Total PnL"     value={`${stats.totalPnl>=0?"+":""}${stats.totalPnl.toFixed(0)}`} color={stats.totalPnl>=0?"#10b981":"#ef4444"}/><StatCard label="30-Day Return" value={`${stats.monthlyReturn>=0?"+":""}${stats.monthlyReturn.toFixed(0)}`} color={stats.monthlyReturn>=0?"#10b981":"#ef4444"} sub="last 30 days"/><StatCard label="Trades"        value={String(stats.totalTrades)} color="#9ca3af"/></div>

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

            {/* Streaks */}
            <div style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:20,padding:"20px 22px"}}><div style={{fontSize:13,fontWeight:800,color:"#ffffff",marginBottom:16}}>Streaks</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                {[
                  {label:"Current Win",  val:stats.currentWinStreak,  color:stats.currentWinStreak>=5?"#f59e0b":stats.currentWinStreak>=3?"#10b981":"#2a2a3a",emoji:stats.currentWinStreak>=10?"":stats.currentWinStreak>=5?"":stats.currentWinStreak>=3?"":""},
                  {label:"Best Win",     val:stats.bestStreak,         color:"#f59e0b",emoji:""},
                  {label:"Daily Trade",  val:stats.currentTradeStreak, color:stats.currentTradeStreak>=7?"#6366f1":"#6b7280",emoji:""},
                  {label:"Best Daily",   val:stats.bestTradeStreak,    color:"#a5b4fc",emoji:"⭐"},
                ].map((s,i)=>(<div key={i} style={{background:"#111118",border:"1px solid #2a2a3a",borderRadius:14,padding:"14px",textAlign:"center"}}><div style={{fontSize:24,marginBottom:6}}>{s.emoji}</div><div style={{fontSize:28,fontWeight:900,fontFamily:"monospace",color:s.color,lineHeight:1}}>{s.val}</div><div style={{fontSize:10,color:"#2a2a3a",marginTop:6,fontWeight:600}}>{s.label} Streak</div></div>
                ))}
              </div></div></div>
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

      </div></div>
  );
}
