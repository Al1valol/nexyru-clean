"use client";
import { useEffect } from "react";

export default function AuthComplete() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token=")) {
      try {
        const params = new URLSearchParams(hash.slice(1));
        const token = params.get("access_token")!;
        const payload = JSON.parse(atob(token.split(".")[1]));
        const email = payload.email || "";
        const username = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        const displayName = payload.user_metadata?.full_name || username;
        localStorage.setItem("tradedesk_session_v1", JSON.stringify({
          username, displayName, email, googleAuth: true
        }));
        window.location.href = "/dashboard";
      } catch(e) {
        window.location.href = "/dashboard";
      }
    } else {
      window.location.href = "/dashboard";
    }
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",gap:12,color:"#3a4a6a",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{width:20,height:20,border:"2px solid #1a2540",borderTopColor:"#38bdf8",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
      Signing you in…
    </div>
  );
}
