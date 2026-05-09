"use client";
import { useEffect, useState } from "react";

export default function AuthComplete() {
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    // Get hash from URL
    const hash = window.location.hash || window.location.search;
    const source = hash.includes("access_token") ? hash.slice(1) : window.location.search.slice(1);
    const params = new URLSearchParams(source);
    const token = params.get("access_token");

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const email = payload.email || "";
        const username = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        const displayName = payload.user_metadata?.full_name || username;
        localStorage.setItem("tradedesk_session_v1", JSON.stringify({
          username, displayName, email, googleAuth: true
        }));
        setStatus("Success! Redirecting...");
        setTimeout(() => { window.location.href = "/dashboard"; }, 500);
      } catch(e) {
        setStatus("Error parsing token, redirecting...");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1000);
      }
    } else {
      // No token in URL - check if already logged in
      const session = localStorage.getItem("tradedesk_session_v1");
      if (session) {
        window.location.href = "/dashboard";
      } else {
        setStatus("No token found, going back...");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1000);
      }
    }
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:"#3a4a6a",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{width:32,height:32,border:"3px solid #1a2540",borderTopColor:"#38bdf8",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
      <div style={{fontSize:14,color:"#38bdf8"}}>{status}</div>
    </div>
  );
}
