"use client";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const signIn = () => {
    setLoading(true);
    // Direct OAuth redirect - no Supabase client needed
    const supabaseUrl = "https://xsrcaceydyqytbipvrok.supabase.co";
    const redirectTo = encodeURIComponent("https://nexyru.com/auth/callback");
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  };

  return (
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:420,padding:20}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:52,marginBottom:16}}>📈</div>
          <h1 style={{fontSize:34,fontWeight:900,color:"#f0f4ff",margin:"0 0 8px",letterSpacing:"-0.03em"}}>Nexyru</h1>
          <p style={{fontSize:14,color:"#3a4a6a",margin:0}}>Your trading journal & performance hub</p>
        </div>
        <div style={{background:"linear-gradient(135deg,#0d1628,#0f1e30)",border:"1px solid #1a2540",borderRadius:24,padding:"36px 32px"}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"#f0f4ff",textAlign:"center",margin:"0 0 6px"}}>Welcome to Nexyru</h2>
          <p style={{fontSize:13,color:"#3a4a6a",textAlign:"center",margin:"0 0 28px"}}>Sign in to access your trades and insights</p>
          <button onClick={signIn} disabled={loading} style={{width:"100%",padding:"14px 20px",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#f0f4ff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
            {loading
              ? <span style={{width:20,height:20,border:"2px solid #1a2540",borderTopColor:"#38bdf8",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
              : <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            }
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0"}}>
            <div style={{flex:1,height:1,background:"#1a2540"}}/>
            <span style={{fontSize:11,color:"#2e3f5a"}}>what you get</span>
            <div style={{flex:1,height:1,background:"#1a2540"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["📊","AI-powered trade analysis"],["🏆","Verified leaderboard rankings"],["📋","Copy top traders"],["🔄","Works across all devices"]].map(([i,t],idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,color:"#475569"}}>
                <span style={{fontSize:16}}>{i}</span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
