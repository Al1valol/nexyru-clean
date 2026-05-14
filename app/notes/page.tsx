"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";

const SESSION_KEY = "tradedesk_session_v1";
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MOODS = ["Focused","Confident","Neutral","Anxious","Distracted"];

type DailyNote = {
  date: string;
  plan?: string;
  review?: string;
  mood?: string;
};

type Trade = { date?: number | string; pnl?: number };

function getUsername(): string {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}").username || ""; }
  catch { return ""; }
}

function loadAllDailyNotes(username: string): DailyNote[] {
  if (!username) return [];
  const prefix = `nexyru_daily_notes_${username}_`;
  const list: DailyNote[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        try {
          const obj = JSON.parse(localStorage.getItem(k) || "");
          if (obj && obj.date) list.push(obj);
        } catch {}
      }
    }
  } catch {}
  return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function loadUserTrades(username: string): Trade[] {
  if (!username) return [];
  try {
    const raw = localStorage.getItem(`tradedesk_trades_${username}_v1`);
    return raw ? JSON.parse(raw) || [] : [];
  } catch { return []; }
}

function saveDailyNotesEntry(username: string, dateStr: string, data: Partial<DailyNote>) {
  if (!username || !dateStr) return;
  try {
    localStorage.setItem(
      `nexyru_daily_notes_${username}_${dateStr}`,
      JSON.stringify({ ...data, date: dateStr })
    );
    window.dispatchEvent(new CustomEvent("nexyruDailyNotesUpdate"));
  } catch {}
}

function deleteDailyNote(username: string, dateStr: string) {
  try {
    localStorage.removeItem(`nexyru_daily_notes_${username}_${dateStr}`);
    window.dispatchEvent(new CustomEvent("nexyruDailyNotesUpdate"));
  } catch {}
}

function formatDateLong(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${WEEKDAY_NAMES[dt.getDay()]}, ${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}, ${y}`;
}

function tradeDateKey(t: Trade): string | null {
  if (t.date === undefined || t.date === null) return null;
  const d = new Date(t.date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MoodBadge({ mood }: { mood?: string }) {
  if (!mood) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc", fontSize: 10, fontWeight: 700 }}>
      {mood}
    </span>
  );
}

function NoteCard({
  note,
  expanded,
  onToggle,
  pnl,
  username,
  onDeleted,
}: {
  note: DailyNote;
  expanded: boolean;
  onToggle: () => void;
  pnl: number | null;
  username: string;
  onDeleted: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState(note.plan ?? "");
  const [review, setReview] = useState(note.review ?? "");
  const [mood, setMood] = useState(note.mood ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setPlan(note.plan ?? "");
    setReview(note.review ?? "");
    setMood(note.mood ?? "");
  }, [note.date, note.plan, note.review, note.mood]);

  const truncStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
  const fullStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#e5e7eb",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  };
  const taStyle: React.CSSProperties = {
    width: "100%", height: 120, padding: "10px 12px", borderRadius: 9, boxSizing: "border-box",
    background: "#0a0a0f", border: "1px solid #1e1e1e", color: "#e5e7eb",
    fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none",
    transition: "border-color 0.15s",
  };

  const handleSave = () => {
    saveDailyNotesEntry(username, note.date, { plan, review, mood });
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 14,
        border: "1px solid #1e1e1e",
        background: "#111111",
        padding: 18,
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hover ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff" }}>{formatDateLong(note.date)}</div>
          <MoodBadge mood={note.mood} />
          {pnl !== null && (
            <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "monospace", padding: "2px 8px", borderRadius: 6, background: pnl >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: pnl >= 0 ? "#10b981" : "#ef4444", border: `1px solid ${pnl >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!editing && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.08)", color: "#a5b4fc", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
            >Edit</button>
          )}
          {!editing && (confirmDelete ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); deleteDailyNote(username, note.date); setConfirmDelete(false); onDeleted(); }}
                style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #ef4444", background: "rgba(239,68,68,0.18)", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
              >Confirm</button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid #2a2a3a", background: "transparent", color: "#9ca3af", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
              >Cancel</button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #2a2a3a", background: "transparent", color: "#9ca3af", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
            >Delete</button>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #2a2a3a", background: "transparent", color: "#9ca3af", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
          >{expanded ? "Collapse" : "Expand"}</button>
        </div>
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pre-Session Plan</div>
              <textarea value={plan} onChange={(e) => setPlan(e.target.value)} style={taStyle}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                placeholder="What's your plan for today? Key levels, news events, max trades..."
              />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Post-Session Review</div>
              <textarea value={review} onChange={(e) => setReview(e.target.value)} style={taStyle}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
                placeholder="How did the session go? What did you do well? What to improve?"
              />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Mood</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {MOODS.map((m) => {
                const active = mood === m;
                return (
                  <button key={m} onClick={() => setMood(active ? "" : m)}
                    style={{
                      padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: active ? "rgba(99,102,241,0.16)" : "#111111",
                      border: active ? "1px solid #6366f1" : "1px solid #2a2a3a",
                      color: active ? "#a5b4fc" : "#9ca3af",
                    }}
                  >{m}</button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #2a2a3a", background: "transparent", color: "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#6366f1", color: "#ffffff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save Notes</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div style={{ borderRadius: 10, background: "#0a0a0f", border: "1px solid #1e1e1e", padding: "10px 12px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pre-Session Plan</div>
            {note.plan?.trim() ? (
              <div style={expanded ? fullStyle : truncStyle}>{note.plan}</div>
            ) : (
              <div style={{ fontSize: 12, color: "#4b5563" }}>—</div>
            )}
          </div>
          <div style={{ borderRadius: 10, background: "#0a0a0f", border: "1px solid #1e1e1e", padding: "10px 12px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Post-Session Review</div>
            {note.review?.trim() ? (
              <div style={expanded ? fullStyle : truncStyle}>{note.review}</div>
            ) : (
              <div style={{ fontSize: 12, color: "#4b5563" }}>—</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  const [username, setUsername] = useState("");
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [pnlByDate, setPnlByDate] = useState<Record<string, number>>({});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const u = getUsername();
    setUsername(u);
  }, []);

  useEffect(() => {
    if (!username) return;
    setNotes(loadAllDailyNotes(username));
    const trades = loadUserTrades(username);
    const map: Record<string, number> = {};
    trades.forEach((t) => {
      const k = tradeDateKey(t);
      if (!k) return;
      map[k] = (map[k] || 0) + (Number(t.pnl) || 0);
    });
    setPnlByDate(map);
  }, [username, tick]);

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("nexyruDailyNotesUpdate", h);
    return () => window.removeEventListener("nexyruDailyNotesUpdate", h);
  }, []);

  const stats = useMemo(() => {
    const moods: Record<string, number> = {};
    notes.forEach((n) => {
      if (n.mood) moods[n.mood] = (moods[n.mood] || 0) + 1;
    });
    return { total: notes.length, moods };
  }, [notes]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e5e7eb" }}>
      <Sidebar activePath="/notes" />
      <main style={{ marginLeft: 56, padding: "28px 32px", maxWidth: 1100 }}>
        <div style={{ marginBottom: 24, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>Daily Notes</h1>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {stats.total === 0 ? "No notes yet" : `${stats.total} day${stats.total === 1 ? "" : "s"} journaled`}
            </div>
          </div>
          <a href="/dashboard?tab=journal" style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.08)", color: "#a5b4fc", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            Add today's notes
          </a>
        </div>

        {!username ? (
          <div style={{ padding: 40, textAlign: "center", borderRadius: 12, border: "1px dashed #2a2a3a", color: "#6b7280" }}>
            Sign in to view your daily notes.
          </div>
        ) : notes.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", borderRadius: 14, border: "1px dashed #2a2a3a", color: "#6b7280" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>No notes saved yet</div>
            <div style={{ fontSize: 12 }}>Open the Journal tab and use the Daily Notes section above the calendar to start.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {notes.map((n) => (
              <NoteCard
                key={n.date}
                note={n}
                pnl={pnlByDate[n.date] !== undefined ? pnlByDate[n.date] : null}
                expanded={expandedDate === n.date}
                onToggle={() => setExpandedDate((d) => (d === n.date ? null : n.date))}
                username={username}
                onDeleted={() => setTick((t) => t + 1)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
