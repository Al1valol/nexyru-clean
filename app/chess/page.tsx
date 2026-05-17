"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { Chess } from "chess.js";

const Chessboard = nextDynamic(
  () => import("react-chessboard").then((m) => ({ default: m.Chessboard })),
  { ssr: false },
);

// ───────────────────────── theme ─────────────────────────
const C = {
  bg: "#080808",
  card: "#111111",
  card2: "#161616",
  border: "#1e1e2a",
  borderSoft: "#1a1a1a",
  text: "#ffffff",
  textDim: "#888888",
  textMuted: "#666666",
  accent: "#6366f1",
  accentDim: "rgba(99,102,241,0.12)",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  light: "#e9edf2",
  dark: "#3b4252",
};

const PERF_TYPES = ["bullet", "blitz", "rapid", "classical", "puzzle"] as const;
type PerfKey = (typeof PERF_TYPES)[number];

// ───────────────────────── types ─────────────────────────
interface LichessPerf {
  games?: number;
  rating?: number;
  rd?: number;
  prog?: number;
  prov?: boolean;
}
interface LichessCount {
  win?: number;
  loss?: number;
  draw?: number;
  all?: number;
}
interface LichessProfile {
  id: string;
  username: string;
  title?: string;
  online?: boolean;
  perfs?: Record<string, LichessPerf>;
  count?: LichessCount;
  profile?: { bio?: string; country?: string };
  createdAt?: number;
  url?: string;
}
interface LichessGamePlayer {
  user?: { name: string; title?: string; id?: string };
  rating?: number;
  aiLevel?: number;
}
interface LichessGame {
  id: string;
  rated?: boolean;
  variant?: string;
  speed?: string;
  perf?: string;
  createdAt: number;
  lastMoveAt?: number;
  status?: string;
  winner?: "white" | "black";
  players: { white: LichessGamePlayer; black: LichessGamePlayer };
  opening?: { eco?: string; name?: string; ply?: number };
  moves?: string;
  pgn?: string;
}
interface ImportedGame {
  id: string;
  source: "chesscom" | "lichess";
  white: string;
  black: string;
  result: string; // "1-0" | "0-1" | "1/2-1/2" | "*"
  date?: string;
  opening?: string;
  pgn: string;
}

// ───────────────────────── helpers ─────────────────────────
function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(ms?: number | string) {
  if (!ms) return "";
  const d = typeof ms === "number" ? new Date(ms) : new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function gameResult(g: LichessGame, you: string): "W" | "L" | "D" {
  const youAreWhite = g.players.white.user?.name?.toLowerCase() === you.toLowerCase();
  if (!g.winner) return "D";
  if (g.winner === "white") return youAreWhite ? "W" : "L";
  return youAreWhite ? "L" : "W";
}

function pgnResult(pgn: string): string {
  const m = pgn.match(/\[Result\s+"([^"]+)"\]/);
  return m ? m[1] : "*";
}
function pgnTag(pgn: string, tag: string): string | undefined {
  const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]+)"\\]`));
  return m ? m[1] : undefined;
}

// Parse a string that may contain multiple PGN games
function splitPgns(text: string): string[] {
  const out: string[] = [];
  // Games are typically separated by a blank line between end of moves and next [Event ...]
  // Find positions of [Event "..."] tag occurrences
  const eventIdx: number[] = [];
  const re = /\[Event\s+"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) eventIdx.push(m.index);
  if (eventIdx.length === 0) {
    const trimmed = text.trim();
    if (trimmed) out.push(trimmed);
    return out;
  }
  for (let i = 0; i < eventIdx.length; i++) {
    const start = eventIdx[i];
    const end = i + 1 < eventIdx.length ? eventIdx[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) out.push(chunk);
  }
  return out;
}

// ───────────────────────── page shell ─────────────────────────
export default function ChessPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
      <Sidebar activePath="/chess" />
      <MobileNav activePath="/chess" />
      <main style={{ flex: 1, marginLeft: 56, paddingBottom: 96 }}>
        <ChessPageInner />
      </main>
    </div>
  );
}

// ───────────────────────── inner ─────────────────────────
function ChessPageInner() {
  // Lichess search state
  const [usernameInput, setUsernameInput] = useState("");
  const [searchedUser, setSearchedUser] = useState("");
  const [profile, setProfile] = useState<LichessProfile | null>(null);
  const [lichessGames, setLichessGames] = useState<LichessGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Imported (Chess.com or other) games
  const [importedGames, setImportedGames] = useState<ImportedGame[]>([]);
  const [importErr, setImportErr] = useState<string | null>(null);

  // Selected game / board state
  const [selectedPgn, setSelectedPgn] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("Starting position");
  const [moves, setMoves] = useState<{ san: string; fen: string }[]>([]);
  const [moveIdx, setMoveIdx] = useState(0);
  const [currentOpening, setCurrentOpening] = useState<string | null>(null);

  const handleSearch = useCallback(async (uRaw: string) => {
    const u = uRaw.trim();
    if (!u) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setLichessGames([]);
    setSearchedUser(u);
    try {
      const profRes = await fetch(`https://lichess.org/api/user/${encodeURIComponent(u)}`);
      if (profRes.status === 404) {
        setError("User not found");
        setLoading(false);
        return;
      }
      if (!profRes.ok) {
        setError(`Lichess error (${profRes.status})`);
        setLoading(false);
        return;
      }
      const prof = (await profRes.json()) as LichessProfile;
      setProfile(prof);

      const gamesRes = await fetch(
        `https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=10&moves=true&pgnInJson=true&opening=true`,
        { headers: { Accept: "application/x-ndjson" } },
      );
      if (gamesRes.ok) {
        const text = await gamesRes.text();
        const lines = text.split("\n").filter(Boolean);
        const games = lines
          .map((l) => {
            try {
              return JSON.parse(l) as LichessGame;
            } catch {
              return null;
            }
          })
          .filter((g): g is LichessGame => g !== null);
        setLichessGames(games);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Opening frequency map (from Lichess history)
  const openingFreq = useMemo(() => {
    const m = new Map<string, number>();
    let total = 0;
    for (const g of lichessGames) {
      const name = g.opening?.name;
      if (!name) continue;
      m.set(name, (m.get(name) ?? 0) + 1);
      total++;
    }
    return { map: m, total };
  }, [lichessGames]);

  // Load PGN into board
  const loadPgn = useCallback((pgn: string, title: string) => {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const verbose = chess.history({ verbose: true }) as Array<{ san: string; after: string }>;
      const stepped: { san: string; fen: string }[] = verbose.map((v) => ({
        san: v.san,
        fen: v.after,
      }));
      setMoves(stepped);
      setMoveIdx(stepped.length); // jump to end by default
      setSelectedPgn(pgn);
      setSelectedTitle(title);
      const openingTag = pgnTag(pgn, "Opening");
      setCurrentOpening(openingTag ?? null);
    } catch (err) {
      setError("Could not parse PGN");
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedPgn) return;
      // Ignore when typing in an input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setMoveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setMoveIdx((i) => Math.min(moves.length, i + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setMoveIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setMoveIdx(moves.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPgn, moves.length]);

  const currentFen = useMemo(() => {
    if (!moves.length || moveIdx === 0) {
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    return moves[moveIdx - 1].fen;
  }, [moves, moveIdx]);

  // Chess.com PGN import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onFile = useCallback(async (file: File) => {
    setImportErr(null);
    try {
      const text = await file.text();
      const pgns = splitPgns(text);
      if (pgns.length === 0) {
        setImportErr("No games found in file");
        return;
      }
      const parsed: ImportedGame[] = pgns.map((pgn, i) => ({
        id: `imp_${Date.now()}_${i}`,
        source: "chesscom",
        white: pgnTag(pgn, "White") ?? "?",
        black: pgnTag(pgn, "Black") ?? "?",
        result: pgnResult(pgn),
        date: pgnTag(pgn, "Date") ?? pgnTag(pgn, "UTCDate"),
        opening: pgnTag(pgn, "Opening") ?? pgnTag(pgn, "ECO"),
        pgn,
      }));
      setImportedGames(parsed);
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : "Could not read file");
    }
  }, []);

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1180, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            margin: 0,
            color: C.text,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Chess Coach
        </h1>
        <p style={{ margin: "6px 0 0", color: C.textDim, fontSize: 15 }}>
          Analyze your games, search Lichess stats, and improve your play.
        </p>
      </div>

      {/* Lichess search */}
      <SectionCard title="Search Lichess">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(usernameInput);
          }}
          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Search Lichess username..."
            style={{
              flex: 1,
              minWidth: 240,
              background: C.card2,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: C.text,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: C.accent,
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {profile && (
          <ProfileBlock
            profile={profile}
            games={lichessGames}
            onSelectGame={(g) => {
              if (g.pgn) {
                const title = `${g.players.white.user?.name ?? "?"} vs ${g.players.black.user?.name ?? "?"}`;
                loadPgn(g.pgn, title);
                // Scroll to board
                document.getElementById("chess-board-anchor")?.scrollIntoView({ behavior: "smooth" });
              }
            }}
          />
        )}
      </SectionCard>

      {/* Chess.com import */}
      <SectionCard title="Import from Chess.com">
        <ol style={{ margin: "0 0 14px", paddingLeft: 18, color: C.textDim, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>Go to chess.com/games</li>
          <li>Click Archive</li>
          <li>Export PGN</li>
          <li>Upload here</li>
        </ol>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pgn,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: C.card2,
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Choose PGN file
          </button>
          {importedGames.length > 0 && (
            <span style={{ color: C.textDim, fontSize: 13 }}>
              {importedGames.length} game{importedGames.length === 1 ? "" : "s"} loaded
            </span>
          )}
        </div>
        {importErr && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {importErr}
          </div>
        )}

        {importedGames.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {importedGames.map((g) => (
              <ImportedRow
                key={g.id}
                game={g}
                onClick={() => {
                  loadPgn(g.pgn, `${g.white} vs ${g.black}`);
                  document.getElementById("chess-board-anchor")?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Chess board */}
      <div id="chess-board-anchor" />
      <SectionCard title="Board">
        <BoardView
          fen={currentFen}
          moves={moves}
          moveIdx={moveIdx}
          setMoveIdx={setMoveIdx}
          title={selectedTitle}
          opening={currentOpening}
          openingFreq={openingFreq}
        />
      </SectionCard>
    </div>
  );
}

// ───────────────────────── components ─────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 18,
      }}
    >
      <h2
        style={{
          margin: "0 0 14px",
          color: C.text,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProfileBlock({
  profile,
  games,
  onSelectGame,
}: {
  profile: LichessProfile;
  games: LichessGame[];
  onSelectGame: (g: LichessGame) => void;
}) {
  const username = profile.username;
  return (
    <div style={{ marginTop: 18 }}>
      {/* Identity row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 20,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials(username)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {profile.title && (
              <span
                style={{
                  background: C.amber,
                  color: "#1a1306",
                  padding: "2px 8px",
                  borderRadius: 5,
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                }}
              >
                {profile.title}
              </span>
            )}
            <span style={{ color: C.text, fontWeight: 700, fontSize: 18 }}>{username}</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: profile.online ? C.green : C.textMuted,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: profile.online ? C.green : C.textMuted,
                  boxShadow: profile.online ? `0 0 8px ${C.green}` : "none",
                }}
              />
              {profile.online ? "Online" : "Offline"}
            </span>
          </div>
          {profile.profile?.bio && (
            <div
              style={{
                marginTop: 4,
                color: C.textDim,
                fontSize: 12.5,
                lineHeight: 1.5,
                maxWidth: 720,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {profile.profile.bio}
            </div>
          )}
        </div>
      </div>

      {/* Rating cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 22,
        }}
      >
        {PERF_TYPES.map((p) => (
          <RatingCard key={p} kind={p} perf={profile.perfs?.[p]} count={profile.count} />
        ))}
      </div>

      {/* Recent games */}
      <div>
        <div
          style={{
            color: C.textDim,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Recent games
        </div>
        {games.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13, padding: "8px 0" }}>No games found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {games.map((g) => (
              <GameRow key={g.id} game={g} you={username} onClick={() => onSelectGame(g)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RatingCard({
  kind,
  perf,
  count,
}: {
  kind: PerfKey;
  perf?: LichessPerf;
  count?: LichessCount;
}) {
  const rating = perf?.rating;
  const games = perf?.games ?? 0;
  // count is total record across all games; we only show it on the bullet card aggregate is misleading
  // To match the spec ("W/L/D for each time control"), Lichess does NOT expose per-perf record
  // We expose total W/L/D once and show per-perf game count instead.
  const isAggregate = kind === "bullet";
  return (
    <div
      style={{
        background: C.card2,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          color: C.textDim,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {kind}
      </div>
      <div
        style={{
          color: C.text,
          fontSize: 22,
          fontWeight: 800,
          marginTop: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {rating ?? "—"}
        {perf?.prov && (
          <span
            style={{
              fontSize: 10,
              color: C.textMuted,
              marginLeft: 4,
              fontWeight: 600,
            }}
          >
            ?
          </span>
        )}
      </div>
      <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
        {games.toLocaleString()} {games === 1 ? "game" : "games"}
      </div>
      {isAggregate && count && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 11 }}>
          <span style={{ color: C.green }}>{count.win ?? 0}W</span>
          <span style={{ color: C.red }}>{count.loss ?? 0}L</span>
          <span style={{ color: C.textDim }}>{count.draw ?? 0}D</span>
        </div>
      )}
    </div>
  );
}

function GameRow({
  game,
  you,
  onClick,
}: {
  game: LichessGame;
  you: string;
  onClick: () => void;
}) {
  const result = gameResult(game, you);
  const youAreWhite = game.players.white.user?.name?.toLowerCase() === you.toLowerCase();
  const opp = youAreWhite ? game.players.black : game.players.white;
  const oppName = opp.user?.name ?? (opp.aiLevel ? `Stockfish lvl ${opp.aiLevel}` : "anon");
  const resultColor = result === "W" ? C.green : result === "L" ? C.red : C.textDim;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: C.card2,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        color: C.text,
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "28px 1fr auto auto",
        gap: 12,
        alignItems: "center",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a3a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
    >
      <span
        style={{
          color: resultColor,
          fontWeight: 800,
          fontSize: 14,
          textAlign: "center",
        }}
      >
        {result}
      </span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>vs {oppName}</div>
        <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
          {game.opening?.name ?? game.variant ?? "Standard"}
        </div>
      </span>
      <span
        style={{
          fontSize: 11,
          color: C.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {game.speed ?? game.perf ?? ""}
      </span>
      <span style={{ fontSize: 11.5, color: C.textDim }}>{fmtDate(game.createdAt)}</span>
    </button>
  );
}

function ImportedRow({ game, onClick }: { game: ImportedGame; onClick: () => void }) {
  const resultColor =
    game.result === "1-0"
      ? C.green
      : game.result === "0-1"
        ? C.red
        : game.result === "1/2-1/2"
          ? C.textDim
          : C.textMuted;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: C.card2,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        color: C.text,
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        alignItems: "center",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a3a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
    >
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {game.white} <span style={{ color: C.textMuted, fontWeight: 400 }}>vs</span> {game.black}
        </div>
        <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
          {game.opening ?? "—"}
        </div>
      </span>
      <span style={{ color: resultColor, fontWeight: 700, fontSize: 13 }}>{game.result}</span>
      <span style={{ fontSize: 11.5, color: C.textDim }}>{game.date ?? ""}</span>
    </button>
  );
}

function BoardView({
  fen,
  moves,
  moveIdx,
  setMoveIdx,
  title,
  opening,
  openingFreq,
}: {
  fen: string;
  moves: { san: string; fen: string }[];
  moveIdx: number;
  setMoveIdx: (i: number | ((p: number) => number)) => void;
  title: string;
  opening: string | null;
  openingFreq: { map: Map<string, number>; total: number };
}) {
  const total = openingFreq.total;
  const openingCount = opening ? openingFreq.map.get(opening) ?? 0 : 0;
  const pct = total > 0 && openingCount > 0 ? Math.round((openingCount / total) * 100) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 480px) 1fr",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div>
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 8,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
          }}
        >
          <Chessboard
            options={{
              position: fen,
              boardStyle: { width: "100%", height: "100%" },
              darkSquareStyle: { backgroundColor: C.dark },
              lightSquareStyle: { backgroundColor: C.light },
              animationDurationInMs: 180,
              allowDragging: moves.length === 0, // free play only when no game loaded
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 12,
            justifyContent: "center",
          }}
        >
          <NavBtn onClick={() => setMoveIdx(0)} label="⏮" disabled={!moves.length || moveIdx === 0} />
          <NavBtn
            onClick={() => setMoveIdx((i) => Math.max(0, i - 1))}
            label="◀"
            disabled={!moves.length || moveIdx === 0}
          />
          <NavBtn
            onClick={() => setMoveIdx((i) => Math.min(moves.length, i + 1))}
            label="▶"
            disabled={!moves.length || moveIdx >= moves.length}
          />
          <NavBtn
            onClick={() => setMoveIdx(moves.length)}
            label="⏭"
            disabled={!moves.length || moveIdx >= moves.length}
          />
        </div>
        <div
          style={{
            textAlign: "center",
            color: C.textMuted,
            fontSize: 11,
            marginTop: 8,
          }}
        >
          Use ← / → to step through moves
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ color: C.textDim, fontSize: 13, marginBottom: 14 }}>
          {moves.length > 0
            ? `Move ${moveIdx} of ${moves.length}`
            : "Click a game from above to load it."}
        </div>

        {/* Opening info */}
        {(opening || moves.length === 0) && (
          <div
            style={{
              background: C.card2,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                color: C.textMuted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Opening
            </div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
              {opening ?? "—"}
            </div>
            {pct !== null && (
              <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>
                You tend to play this opening {pct}% of the time ({openingCount} of {total} recent
                games).
              </div>
            )}
          </div>
        )}

        {/* Move list */}
        {moves.length > 0 && (
          <div
            style={{
              background: C.card2,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 12,
              maxHeight: 360,
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12.5,
              lineHeight: 1.9,
            }}
          >
            {chunkMoves(moves).map((pair, i) => (
              <span key={i} style={{ marginRight: 12 }}>
                <span style={{ color: C.textMuted, marginRight: 4 }}>{i + 1}.</span>
                <span
                  onClick={() => setMoveIdx(i * 2 + 1)}
                  style={{
                    cursor: "pointer",
                    color: moveIdx === i * 2 + 1 ? C.accent : C.text,
                    fontWeight: moveIdx === i * 2 + 1 ? 700 : 500,
                    marginRight: 6,
                  }}
                >
                  {pair[0].san}
                </span>
                {pair[1] && (
                  <span
                    onClick={() => setMoveIdx(i * 2 + 2)}
                    style={{
                      cursor: "pointer",
                      color: moveIdx === i * 2 + 2 ? C.accent : C.text,
                      fontWeight: moveIdx === i * 2 + 2 ? 700 : 500,
                    }}
                  >
                    {pair[1].san}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NavBtn({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: C.card2,
        border: `1px solid ${C.border}`,
        color: disabled ? C.textMuted : C.text,
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 14,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function chunkMoves(moves: { san: string; fen: string }[]) {
  const pairs: [{ san: string; fen: string }, { san: string; fen: string } | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]]);
  }
  return pairs;
}
