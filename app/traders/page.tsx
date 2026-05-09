"use client";
import { useState, useEffect } from "react";
interface Trader { username:string;totalTrades:number;winRate:number;totalPnl:number;winStreak:number;verifiedTrades:number;avatarColor:string; }
const COLORS=["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b","#f43f5e","#22d3ee","#818cf8"];
function getRank(t:number,w:number){if(t>=200&&w>=60)return{l:"Funded Trader",c:"#f59e0b"};if(t>=100&&w>=55)return{l:"Verified Trader",c:"#a78bfa"};if(t>=50&&w>=50)return{l:"Consistent",c:"#34d399"};if(t>=20)return{l:"Active Trader",c:"#38bdf8"};return{l:"Beginner",c:"#64748b"};}
function Card({t,me}:{t:Trader;me:string}){
  const r=getRank(t.totalTrades,t.winRate);const pos=t.totalPnl>=0;
  return(<a href={`/trader/@${t.username}`} style={{textDecoration:"none",display:"block"}}>
    <div style={{background:"#0b1120",border:"1px solid #1a2540",borderRadius:18,padding:"20px",cursor:"pointer",position:"relative",overflow:"hidden"}} onMouseEnter={e=>(e.currentTarget.style.borderColor="#1e3050")} onMouseLeave={e=>(e.currentTarget.style.borderColor="#1a2540")}>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`${t.avatarColor}07`,pointerEvents:"none"}}/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{width:48,height:48,borderRadius:14,background:`${t.avatarColor}20`,border:`1.5px solid ${t.avatarColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:t.avatarColor,fontFamily:"monospace",flexShrink:0,position:"relative"}}>
          {t.username.slice(0,2).toUpperCase()}
          {t.verifiedTrades>=50&&<div style={{position:"absolute",bottom:-3,right:-3,width:14,height:14,borderRadius:"50%",background:"#f59e0b",border:"1.5px solid #060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:900,color:"#000"}}>✓</div>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <span style={{fontSize:13,fontWeight:800,color:"#f0f4ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{t.username}</span>
            {me===t.username&&<span style={{fontSize:8,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"rgba(56,189,248,0.1)",color:"#38bdf8",flexShrink:0}}>YOU</span>}
          </div>
          <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,background:`${r.c}15`,border:`1px solid ${r.c}30`,color:r.c}}>{r.l}</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[{l:"Win Rate",v:`${t.winRate}%`,c:t.winRate>=55?"#34d399":t.winRate>=45?"#fbbf24":"#f87171"},{l:"PnL",v:`${pos?"+":""}${Math.abs(t.totalPnl)>=1000?`${(t.totalPnl/1000).toFixed(1)}k`:t.totalPnl.toFixed(0)}`,c:pos?"#34d399":"#f87171"},{l:"Trades",v:String(t.totalTrades),c:"#94a3b8"}].map((s,i)=>(
          <div key={i} style={{background:"#0d1628",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:8,fontWeight:700,color:"#3a4a6a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:16,fontWeight:900,fontFamily:"monospace",color:s.c,lineHeight:1}}>{s.v}</div>
          </div>
        ))}
      </div>
      {t.winStreak>=3&&<div style={{marginTop:10,fontSize:10,color:"#f97316",fontWeight:700}}>{t.winStreak>=7?"🔥":"⚡"} {t.winStreak} win streak</div>}
    </div>
  </a>);
}
export default function BrowseTraders(){
  const [traders,setTraders]=useState<Trader[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<"trades"|"winRate"|"pnl">("trades");
  const [me,setMe]=useState("");
  useEffect(()=>{
    try{const s=JSON.parse(localStorage.getItem("tradedesk_session_v1")??"{}");setMe(s.username??"");}catch{}
    const accounts:Record<string,any>=JSON.parse(localStorage.getItem("tradedesk_accounts_v1")??"{}");
    const result:Trader[]=[];
    for(const u of Object.keys(accounts)){
      try{
        const raw:any[]=JSON.parse(localStorage.getItem(`tradedesk_trades_${u}_v1`)??"[]");
        const t=raw.filter(x=>x.source!=="demo");const d=t.length>0?t:raw;
        const wins=d.filter((x:any)=>(x.pnl??0)>0).length;
        const wr=d.length?Math.round((wins/d.length)*100):0;
        const pnl=d.reduce((s:number,x:any)=>s+(x.pnl??0),0);
        const vt=d.filter((x:any)=>x.source==="broker_import").length;
        const sorted=[...d].sort((a:any,b:any)=>b.date-a.date);let streak=0;for(const x of sorted){if((x.pnl??0)>0)streak++;else break;}
        result.push({username:u,totalTrades:d.length,winRate:wr,totalPnl:parseFloat(pnl.toFixed(2)),winStreak:streak,verifiedTrades:vt,avatarColor:COLORS[u.charCodeAt(0)%COLORS.length]});
      }catch{}
    }
    setTraders(result);setLoading(false);
  },[]);
  const filtered=traders.filter(t=>!search||t.username.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==="winRate"?b.winRate-a.winRate:sort==="pnl"?b.totalPnl-a.totalPnl:b.totalTrades-a.totalTrades);
  return(
    <div style={{minHeight:"100vh",background:"#060d1a",color:"#c8d8f0",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{borderBottom:"1px solid #0d1628",background:"rgba(6,13,26,0.97)",padding:"14px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)"}}>
        <a href="/dashboard" style={{fontSize:12,color:"#3a4a6a",textDecoration:"none"}}>← Dashboard</a>
        <div style={{flex:1}}/>
        <a href="/leaderboard" style={{padding:"6px 14px",borderRadius:8,border:"1px solid #1a2540",background:"#0b1120",color:"#64748b",fontSize:11,fontWeight:600,textDecoration:"none"}}>🏆 Leaderboard</a>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px",animation:"fadeIn 0.4s ease"}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:24,fontWeight:900,color:"#f0f4ff",margin:"0 0 6px",letterSpacing:"-0.02em"}}>Browse Traders</h1>
          <p style={{fontSize:13,color:"#3a4a6a",margin:0}}>{traders.length} trader{traders.length!==1?"s":""} on Nexyru</p>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200,position:"relative"}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#3a4a6a"}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search username…" style={{width:"100%",padding:"10px 12px 10px 36px",borderRadius:10,background:"#0b1120",border:"1px solid #1a2540",color:"#e2e8f0",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",gap:6}}>
            {(["trades","winRate","pnl"] as const).map(k=>(
              <button key={k} onClick={()=>setSort(k)} style={{padding:"9px 14px",borderRadius:9,border:`1px solid ${sort===k?"rgba(56,189,248,0.4)":"#1a2540"}`,background:sort===k?"rgba(56,189,248,0.08)":"#0b1120",color:sort===k?"#38bdf8":"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                {k==="trades"?"Most Trades":k==="winRate"?"Win Rate":"Top PnL"}
              </button>
            ))}
          </div>
        </div>
        {loading?(
          <div style={{textAlign:"center",padding:"60px",color:"#3a4a6a"}}>
            <div style={{display:"inline-block",width:24,height:24,border:"2px solid #1a2540",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite",marginBottom:12}}/>
            <div style={{fontSize:13}}>Finding traders…</div>
          </div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"80px 20px",color:"#3a4a6a"}}>
            <div style={{fontSize:48,marginBottom:16}}>👥</div>
            <div style={{fontSize:16,fontWeight:700,color:"#475569",marginBottom:8}}>{search?`No traders matching "${search}"`:"No traders yet"}</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
            {filtered.map(t=><Card key={t.username} t={t} me={me}/>)}
          </div>
        )}
      </div>
    </div>
  );
}
