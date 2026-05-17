"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import { Chess } from "chess.js";
import type { Square } from "chess.js";

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
  textDim: "#9aa0aa",
  textMuted: "#6b7280",
  accent: "#4a6741",
  accentBright: "#5b7d52",
  accentDim: "rgba(74,103,65,0.18)",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  squareLight: "#e9edf2",
  squareDark: "#3b4252",
};

// ───────────────────────── types ─────────────────────────
type Mode = "free" | "play" | "review";
type Platform = "chesscom" | "lichess";
type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";

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
interface LichessPlayer {
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
  players: { white: LichessPlayer; black: LichessPlayer };
  opening?: { eco?: string; name?: string; ply?: number };
  moves?: string;
}
interface ImportedGame {
  id: string;
  white: string;
  black: string;
  result: string;
  date?: string;
  opening?: string;
  pgn: string;
}

// Chess.com types
interface ChesscomProfile {
  username: string;
  player_id?: number;
  url?: string;
  name?: string;
  avatar?: string;
  title?: string;
  country?: string; // url like https://api.chess.com/pub/country/US
  last_online?: number;
  joined?: number;
  status?: string;
  followers?: number;
  is_streamer?: boolean;
  verified?: boolean;
}
interface ChesscomRecord {
  win?: number;
  loss?: number;
  draw?: number;
}
interface ChesscomTimeStats {
  last?: { rating?: number; date?: number; rd?: number };
  best?: { rating?: number; date?: number };
  record?: ChesscomRecord;
}
interface ChesscomStats {
  chess_bullet?: ChesscomTimeStats;
  chess_blitz?: ChesscomTimeStats;
  chess_rapid?: ChesscomTimeStats;
  chess_daily?: ChesscomTimeStats;
  tactics?: { highest?: { rating?: number } };
  puzzle_rush?: { best?: { score?: number } };
  fide?: number;
}
interface ChesscomGamePlayer {
  username: string;
  rating?: number;
  result?: string;
  "@id"?: string;
}
interface ChesscomGame {
  url?: string;
  pgn: string;
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  time_class?: string;
  rules?: string;
  white: ChesscomGamePlayer;
  black: ChesscomGamePlayer;
}

// ───────────────────────── engine ─────────────────────────
const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// PSTs from white's perspective; row 0 = 8th rank (top), col 0 = a-file (left).
// chess.js board() returns the same layout (board[0] = 8th rank).
// prettier-ignore
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];
// prettier-ignore
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
// prettier-ignore
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];
// prettier-ignore
const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];
// prettier-ignore
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];
// prettier-ignore
const PST_KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

const PST: Record<PieceSymbol, number[]> = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
  k: PST_KING_MID,
};

function pstScore(type: PieceSymbol, color: "w" | "b", rankIdx: number, fileIdx: number) {
  const r = color === "w" ? rankIdx : 7 - rankIdx;
  return PST[type][r * 8 + fileIdx];
}

// ───────────────────────── openings ─────────────────────────
const OPENINGS: Record<string, string> = {
  e4: "King's Pawn Opening",
  "e4 e5": "Open Game",
  "e4 e5 Nf3": "King's Knight Opening",
  "e4 e5 Nf3 Nc6": "Three Knights / Four Knights area",
  "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez (Spanish Opening)",
  "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
  "e4 e5 Nf3 Nc6 Bc4 Bc5": "Giuoco Piano",
  "e4 e5 Nf3 Nc6 Bc4 Nf6": "Two Knights Defense",
  "e4 e5 Nf3 Nc6 d4": "Scotch Game",
  "e4 e5 Nf3 Nc6 d4 exd4": "Scotch Game accepted",
  "e4 e5 Nf3 f5": "Latvian Gambit",
  "e4 e5 f4": "King's Gambit",
  "e4 e5 f4 exf4": "King's Gambit Accepted",
  "e4 c5": "Sicilian Defense",
  "e4 c5 Nf3": "Sicilian - Open",
  "e4 c5 Nf3 d6": "Sicilian - Najdorf area",
  "e4 c5 Nf3 d6 d4": "Sicilian - Open variation",
  "e4 c5 Nf3 Nc6": "Sicilian - Classical",
  "e4 c5 c3": "Sicilian - Alapin",
  "e4 c5 Nc3": "Sicilian - Closed",
  "e4 e6": "French Defense",
  "e4 e6 d4": "French - Main line",
  "e4 e6 d4 d5": "French - Standard",
  "e4 e6 d4 d5 Nc3": "French - Classical",
  "e4 e6 d4 d5 e5": "French - Advance",
  "e4 e6 d4 d5 exd5": "French - Exchange",
  "e4 c6": "Caro-Kann Defense",
  "e4 c6 d4": "Caro-Kann - Main",
  "e4 c6 d4 d5": "Caro-Kann - Classical",
  "e4 d5": "Scandinavian Defense",
  "e4 d5 exd5": "Scandinavian - Main line",
  "e4 d6": "Pirc Defense",
  "e4 g6": "Modern Defense",
  "e4 Nf6": "Alekhine's Defense",
  d4: "Queen's Pawn Opening",
  "d4 d5": "Queen's Gambit area",
  "d4 d5 c4": "Queen's Gambit",
  "d4 d5 c4 e6": "Queen's Gambit Declined",
  "d4 d5 c4 c6": "Slav Defense",
  "d4 d5 c4 dxc4": "Queen's Gambit Accepted",
  "d4 Nf6": "Indian Defense",
  "d4 Nf6 c4": "Indian - Main",
  "d4 Nf6 c4 g6": "King's Indian Defense",
  "d4 Nf6 c4 e6": "Nimzo/Queen's Indian area",
  "d4 Nf6 c4 e6 Nc3": "Nimzo-Indian Defense",
  "d4 Nf6 c4 e6 Nf3": "Queen's Indian Defense",
  "d4 Nf6 Nf3": "Torre Attack area",
  "d4 f5": "Dutch Defense",
  c4: "English Opening",
  "c4 e5": "English - Reversed Sicilian",
  "c4 Nf6": "English - Indian",
  Nf3: "Reti Opening",
  "Nf3 d5": "Reti - Main",
  "Nf3 Nf6": "Reti - Symmetrical",
  g3: "King's Fianchetto",
  b3: "Nimzowitsch-Larsen Attack",
  b4: "Polish Opening",
  f4: "Bird's Opening",
};

function findOpening(sanMoves: string[]): string | null {
  const cap = Math.min(sanMoves.length, 12);
  for (let len = cap; len > 0; len--) {
    const key = sanMoves.slice(0, len).join(" ");
    if (OPENINGS[key]) return OPENINGS[key];
  }
  return null;
}

function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const t = sq.type as PieceSymbol;
      const val = PIECE_VALUES[t] + pstScore(t, sq.color, r, f);
      score += (sq.color === "w" ? 1 : -1) * val;
    }
  }
  return score;
}

function orderedMoves(chess: Chess): string[] {
  const moves = chess.moves({ verbose: true }) as Array<{ san: string; captured?: PieceSymbol }>;
  return moves
    .slice()
    .sort((a, b) => {
      const av = (a.captured ? PIECE_VALUES[a.captured] : 0) + (a.san.includes("+") ? 50 : 0);
      const bv = (b.captured ? PIECE_VALUES[b.captured] : 0) + (b.san.includes("+") ? 50 : 0);
      return bv - av;
    })
    .map((m) => m.san);
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess);
  const moves = orderedMoves(chess);
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      chess.move(m);
      const v = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      chess.move(m);
      const v = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

interface BestMove {
  from: Square;
  to: Square;
  san: string;
  score: number;
}

function findBestMove(fen: string, depth: number): BestMove | null {
  const chess = new Chess(fen);
  const verbose = chess.moves({ verbose: true }) as Array<{
    san: string;
    from: Square;
    to: Square;
    captured?: PieceSymbol;
  }>;
  if (verbose.length === 0) return null;
  const maximizing = chess.turn() === "w";
  verbose.sort((a, b) => {
    const av = (a.captured ? PIECE_VALUES[a.captured] : 0) + (a.san.includes("+") ? 50 : 0);
    const bv = (b.captured ? PIECE_VALUES[b.captured] : 0) + (b.san.includes("+") ? 50 : 0);
    return bv - av;
  });
  let bestScore = maximizing ? -Infinity : Infinity;
  let best = verbose[0];
  for (const m of verbose) {
    chess.move(m.san);
    const v = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();
    if (maximizing ? v > bestScore : v < bestScore) {
      bestScore = v;
      best = m;
    }
  }
  return { from: best.from, to: best.to, san: best.san, score: bestScore };
}

// ───────────────────────── helpers ─────────────────────────
function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}
function fmtDate(ms?: number) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function memberSince(ms?: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
function gameResultForUser(g: LichessGame, you: string): "W" | "L" | "D" {
  const youWhite = g.players.white.user?.name?.toLowerCase() === you.toLowerCase();
  if (!g.winner) return "D";
  if (g.winner === "white") return youWhite ? "W" : "L";
  return youWhite ? "L" : "W";
}
function pgnTag(pgn: string, tag: string): string | undefined {
  const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]+)"\\]`));
  return m ? m[1] : undefined;
}
function pgnResult(pgn: string): string {
  return pgnTag(pgn, "Result") ?? "*";
}
function chesscomCountryCode(countryUrl?: string): string | null {
  if (!countryUrl) return null;
  const m = countryUrl.match(/\/country\/([A-Z]{2})$/);
  return m ? m[1] : null;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6 - "A".charCodeAt(0);
  return String.fromCodePoint(code.charCodeAt(0) + A, code.charCodeAt(1) + A);
}

function chesscomGameResult(g: ChesscomGame, you: string): "W" | "L" | "D" {
  const youLower = you.toLowerCase();
  const youColor =
    g.white.username?.toLowerCase() === youLower
      ? "white"
      : g.black.username?.toLowerCase() === youLower
        ? "black"
        : null;
  const drawResults = new Set([
    "agreed",
    "repetition",
    "stalemate",
    "insufficient",
    "50move",
    "timevsinsufficient",
  ]);
  if (youColor === "white") {
    if (g.white.result === "win") return "W";
    if (drawResults.has(g.white.result ?? "")) return "D";
    return "L";
  }
  if (youColor === "black") {
    if (g.black.result === "win") return "W";
    if (drawResults.has(g.black.result ?? "")) return "D";
    return "L";
  }
  return "D";
}

function chesscomOpeningFromPgn(pgn: string): string | undefined {
  const ecoUrl = pgnTag(pgn, "ECOUrl");
  if (ecoUrl) {
    const slug = ecoUrl.split("/").pop() ?? "";
    return slug.replace(/-/g, " ").replace(/\s+/g, " ").trim() || undefined;
  }
  return pgnTag(pgn, "Opening") ?? pgnTag(pgn, "ECO");
}

function splitPgns(text: string): string[] {
  const out: string[] = [];
  const re = /\[Event\s+"/g;
  const idx: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) idx.push(m.index);
  if (idx.length === 0) {
    const t = text.trim();
    if (t) out.push(t);
    return out;
  }
  for (let i = 0; i < idx.length; i++) {
    const start = idx[i];
    const end = i + 1 < idx.length ? idx[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) out.push(chunk);
  }
  return out;
}

// ───────────────────────── page ─────────────────────────
export default function ChessCoachPage() {
  // ── search state ──
  const [platform, setPlatform] = useState<Platform>("chesscom");
  const [usernameInput, setUsernameInput] = useState("");
  const [profile, setProfile] = useState<LichessProfile | null>(null);
  const [lichessGames, setLichessGames] = useState<LichessGame[]>([]);
  const [chesscomProfile, setChesscomProfile] = useState<ChesscomProfile | null>(null);
  const [chesscomStats, setChesscomStats] = useState<ChesscomStats | null>(null);
  const [chesscomGames, setChesscomGames] = useState<ChesscomGame[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ── imported games ──
  const [importedGames, setImportedGames] = useState<ImportedGame[]>([]);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── board state ──
  const [mode, setMode] = useState<Mode>("free");
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [reviewMoves, setReviewMoves] = useState<{ san: string; fen: string }[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewTitle, setReviewTitle] = useState<string>("");

  const [playUserColor, setPlayUserColor] = useState<"w" | "b">("w");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiHint, setAiHint] = useState<BestMove | null>(null);
  const [aiDepth, setAiDepth] = useState(4);
  const [gameOverMsg, setGameOverMsg] = useState<string | null>(null);

  // ── live (Chrome extension) ──
  const [isLive, setIsLive] = useState(false);
  const lastLiveCountRef = useRef<number>(-1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIsLive(params.get("mode") === "live");
  }, []);

  // ── derived ──
  const currentFen = useMemo(() => {
    if (mode === "review") {
      if (!reviewMoves.length || reviewIdx === 0) {
        return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      }
      return reviewMoves[reviewIdx - 1].fen;
    }
    return fen;
  }, [mode, reviewMoves, reviewIdx, fen]);

  const openingFreq = useMemo(() => {
    const m = new Map<string, number>();
    let total = 0;
    for (const g of lichessGames) {
      if (g.opening?.name) {
        m.set(g.opening.name, (m.get(g.opening.name) ?? 0) + 1);
        total++;
      }
    }
    return { map: m, total };
  }, [lichessGames]);

  // Dynamic opening recognition from current move history
  const currentSanMoves = useMemo(() => {
    if (mode === "review") {
      return reviewMoves.slice(0, reviewIdx).map((m) => m.san);
    }
    // chess.history() reflects mutable Chess instance; re-key on fen to refresh
    void fen;
    return chess.history();
  }, [mode, reviewMoves, reviewIdx, chess, fen]);

  const currentOpening = useMemo(() => findOpening(currentSanMoves), [currentSanMoves]);

  // ── handlers ──
  const handleSearch = useCallback(
    async (raw: string) => {
      const u = raw.trim();
      if (!u) return;
      setSearchLoading(true);
      setSearchError(null);
      // Clear both sides — keeps results consistent with the active toggle
      setProfile(null);
      setLichessGames([]);
      setChesscomProfile(null);
      setChesscomStats(null);
      setChesscomGames([]);

      try {
        if (platform === "lichess") {
          const profRes = await fetch(`https://lichess.org/api/user/${encodeURIComponent(u)}`, {
            headers: { Accept: "application/json" },
          });
          if (profRes.status === 404) {
            setSearchError("User not found");
            return;
          }
          if (!profRes.ok) {
            setSearchError(`Lichess error (${profRes.status})`);
            return;
          }
          setProfile((await profRes.json()) as LichessProfile);

          const gamesRes = await fetch(
            `https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=20&moves=true&opening=true`,
            { headers: { Accept: "application/x-ndjson" } },
          );
          if (gamesRes.ok) {
            const text = await gamesRes.text();
            const games = text
              .split("\n")
              .filter(Boolean)
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
        } else {
          // Chess.com via server proxy (avoids CORS)
          const profRes = await fetch(
            `/api/chess-profile?type=profile&username=${encodeURIComponent(u)}`,
          );
          if (profRes.status === 404) {
            setSearchError("User not found");
            return;
          }
          if (!profRes.ok) {
            const errBody = await profRes.json().catch(() => ({}));
            setSearchError(
              (errBody as { error?: string }).error ?? `Chess.com error (${profRes.status})`,
            );
            return;
          }
          setChesscomProfile((await profRes.json()) as ChesscomProfile);

          // Stats (best-effort)
          const statsRes = await fetch(
            `/api/chess-profile?type=stats&username=${encodeURIComponent(u)}`,
          );
          if (statsRes.ok) {
            setChesscomStats((await statsRes.json()) as ChesscomStats);
          }

          // Archives → fetch latest archive's games
          const arcRes = await fetch(
            `/api/chess-profile?type=archives&username=${encodeURIComponent(u)}`,
          );
          if (arcRes.ok) {
            const arcData = (await arcRes.json()) as { archives?: string[] };
            const archives = arcData.archives ?? [];
            if (archives.length > 0) {
              // Latest archive is last in the list
              const latest = archives[archives.length - 1];
              const gamesRes = await fetch(
                `/api/chess-profile?type=games&url=${encodeURIComponent(latest)}`,
              );
              if (gamesRes.ok) {
                const data = (await gamesRes.json()) as { games?: ChesscomGame[] };
                const games = data.games ?? [];
                // Show most recent 20 (archive is chronological asc)
                setChesscomGames(games.slice(-20).reverse());
              }
            }
          }
        }
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Network error");
      } finally {
        setSearchLoading(false);
      }
    },
    [platform],
  );

  const loadGameFromMoves = useCallback((sanMoves: string, title: string) => {
    try {
      const c = new Chess();
      const tokens = sanMoves.trim().split(/\s+/).filter(Boolean);
      const stepped: { san: string; fen: string }[] = [];
      for (const t of tokens) {
        try {
          c.move(t);
        } catch {
          break;
        }
        stepped.push({ san: t, fen: c.fen() });
      }
      if (!stepped.length) return;
      setMode("review");
      setReviewMoves(stepped);
      setReviewIdx(stepped.length);
      setReviewTitle(title);
      setAiHint(null);
      setGameOverMsg(null);
    } catch {
      // ignore
    }
  }, []);

  const loadGameFromPgn = useCallback((pgn: string, title: string) => {
    try {
      const c = new Chess();
      c.loadPgn(pgn);
      const verbose = c.history({ verbose: true }) as Array<{ san: string; after: string }>;
      const stepped = verbose.map((v) => ({ san: v.san, fen: v.after }));
      if (!stepped.length) return;
      setMode("review");
      setReviewMoves(stepped);
      setReviewIdx(stepped.length);
      setReviewTitle(title);
      setAiHint(null);
      setGameOverMsg(null);
    } catch {
      // ignore
    }
  }, []);

  // ── PGN file import ──
  const onFile = useCallback(async (file: File) => {
    setImportErr(null);
    try {
      const text = await file.text();
      const pgns = splitPgns(text);
      if (!pgns.length) {
        setImportErr("No games found in file");
        return;
      }
      const parsed: ImportedGame[] = pgns.map((pgn, i) => ({
        id: `imp_${Date.now()}_${i}`,
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

  // ── play vs AI: AI move after user move ──
  const playAiMove = useCallback(() => {
    if (chess.isGameOver()) return;
    setAiThinking(true);
    setTimeout(() => {
      const best = findBestMove(chess.fen(), aiDepth);
      if (best) {
        chess.move(best.san);
        setFen(chess.fen());
      }
      if (chess.isGameOver()) {
        setGameOverMsg(describeGameOver(chess));
      }
      setAiThinking(false);
    }, 30);
  }, [chess, aiDepth]);

  // ── board drop handler ──
  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare) return false;
      if (mode === "review") return false;
      try {
        const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (!move) return false;
      } catch {
        return false;
      }
      setFen(chess.fen());
      setAiHint(null);
      if (chess.isGameOver()) {
        setGameOverMsg(describeGameOver(chess));
        return true;
      }
      if (mode === "play" && chess.turn() !== playUserColor) {
        playAiMove();
      }
      return true;
    },
    [chess, mode, playUserColor, playAiMove],
  );

  // ── start play vs AI ──
  const startPlayVsAi = useCallback(
    (userColor: "w" | "b") => {
      chess.reset();
      setFen(chess.fen());
      setMode("play");
      setPlayUserColor(userColor);
      setAiHint(null);
      setGameOverMsg(null);
      if (userColor === "b") {
        // AI plays first as white
        setTimeout(() => {
          setAiThinking(true);
          setTimeout(() => {
            const best = findBestMove(chess.fen(), aiDepth);
            if (best) {
              chess.move(best.san);
              setFen(chess.fen());
            }
            setAiThinking(false);
          }, 30);
        }, 0);
      }
    },
    [chess, aiDepth],
  );

  const resetFree = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setMode("free");
    setAiHint(null);
    setGameOverMsg(null);
  }, [chess]);

  const exitReview = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setMode("free");
    setReviewMoves([]);
    setReviewIdx(0);
    setReviewTitle("");
  }, [chess]);

  const suggestBestMove = useCallback(() => {
    const f = mode === "review" ? currentFen : fen;
    setAiThinking(true);
    setTimeout(() => {
      const best = findBestMove(f, aiDepth);
      setAiHint(best);
      setAiThinking(false);
    }, 30);
  }, [mode, currentFen, fen, aiDepth]);

  // ── live: apply moves arriving from extension ──
  const applyLiveMoves = useCallback(
    (moveList: unknown) => {
      if (!Array.isArray(moveList)) return;
      const sanList = moveList.filter((x): x is string => typeof x === "string");
      if (sanList.length === lastLiveCountRef.current) return;
      lastLiveCountRef.current = sanList.length;

      const c = new Chess();
      const stepped: { san: string; fen: string }[] = [];
      for (const san of sanList) {
        try {
          c.move(san);
        } catch {
          break;
        }
        stepped.push({ san, fen: c.fen() });
      }

      setMode("review");
      setReviewMoves(stepped);
      setReviewIdx(stepped.length);
      setReviewTitle("Live game");
      setGameOverMsg(null);

      if (stepped.length > 0) {
        const lastFen = stepped[stepped.length - 1].fen;
        setAiThinking(true);
        setTimeout(() => {
          const best = findBestMove(lastFen, aiDepth);
          setAiHint(best);
          setAiThinking(false);
        }, 30);
      } else {
        setAiHint(null);
      }
    },
    [aiDepth],
  );

  // ── live: postMessage listener ──
  useEffect(() => {
    if (!isLive) return;
    function onMsg(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== "CHESS_COACH_UPDATE") return;
      applyLiveMoves((data as { moveList?: unknown }).moveList);
    }
    window.addEventListener("message", onMsg);
    if (window.opener) {
      try {
        window.opener.postMessage({ type: "COACH_READY" }, "*");
      } catch {
        // cross-origin opener may reject — fine, extension can poll instead
      }
    }
    return () => window.removeEventListener("message", onMsg);
  }, [isLive, applyLiveMoves]);

  // ── live: localStorage poll fallback ──
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      try {
        const raw = localStorage.getItem("nexyru_chess_live");
        if (!raw) return;
        const data = JSON.parse(raw) as { timestamp?: number; moveList?: unknown };
        if (!data.timestamp || Date.now() - data.timestamp > 10000) return;
        if (
          Array.isArray(data.moveList) &&
          data.moveList.length !== lastLiveCountRef.current
        ) {
          applyLiveMoves(data.moveList);
        }
      } catch {
        // ignore parse errors
      }
    }, 2000);
    return () => clearInterval(id);
  }, [isLive, applyLiveMoves]);

  // ── keyboard nav for review ──
  useEffect(() => {
    if (mode !== "review") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setReviewIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setReviewIdx((i) => Math.min(reviewMoves.length, i + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setReviewIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setReviewIdx(reviewMoves.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, reviewMoves.length]);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* ── NAV ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(8,8,8,0.85)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <a
            href="/chess"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: C.text,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: `linear-gradient(135deg,${C.accent},${C.accentBright})`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              ♟
            </span>
            ChessCoach <span style={{ color: C.textMuted, fontWeight: 500 }}>by Nexyru</span>
          </a>
          <nav className="cc-nav-links" style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollTo("features");
              }}
              style={navLink}
            >
              Features
            </a>
            <a
              href="#lichess"
              onClick={(e) => {
                e.preventDefault();
                scrollTo("lichess");
              }}
              style={navLink}
            >
              Lichess Search
            </a>
            <a
              href="#import"
              onClick={(e) => {
                e.preventDefault();
                scrollTo("import");
              }}
              style={navLink}
            >
              PGN Import
            </a>
          </nav>
          <a
            href="/"
            style={{
              color: C.textDim,
              textDecoration: "none",
              fontSize: 13,
              padding: "8px 14px",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            ← Back to Nexyru
          </a>
        </div>
      </header>

      {/* ── LIVE BANNER ── */}
      {isLive && (
        <div
          style={{
            maxWidth: 1200,
            margin: "16px auto 0",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              background: "rgba(74,103,65,0.2)",
              border: "1px solid rgba(74,103,65,0.4)",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              className="cc-live-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: C.accent,
              }}
            />
            <span style={{ color: "#86a97d", fontSize: 13, fontWeight: 600 }}>
              Live coaching active — play on Chess.com to see moves here
            </span>
            {lastLiveCountRef.current > 0 && (
              <span style={{ color: C.textDim, fontSize: 12, marginLeft: "auto" }}>
                {lastLiveCountRef.current} move{lastLiveCountRef.current === 1 ? "" : "s"} received
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section
        style={{
          padding: "72px 24px 56px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 48,
            alignItems: "center",
          }}
          className="cc-hero-grid"
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                background: C.accentDim,
                border: `1px solid ${C.accent}`,
                borderRadius: 999,
                fontSize: 12,
                color: C.accentBright,
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              <span>♟</span> Free chess coaching, powered by Lichess
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
              className="cc-hero-h1"
            >
              Your personal chess coach.
            </h1>
            <p
              style={{
                margin: "20px 0 32px",
                fontSize: 18,
                color: C.textDim,
                maxWidth: 560,
                lineHeight: 1.6,
              }}
            >
              Search your Lichess profile, review your games, and find exactly where you&apos;re losing.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => scrollTo("lichess")}
                style={{
                  background: C.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "13px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.accentBright)}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
              >
                Search Lichess username
              </button>
              <button
                onClick={() => scrollTo("import")}
                style={{
                  background: "transparent",
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "13px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "border-color 150ms, background 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2a2a3a";
                  e.currentTarget.style.background = C.card2;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Import Chess.com games
              </button>
            </div>
          </div>

          {/* Mini illustration */}
          <MiniBoard />
        </div>
      </section>

      {/* ── LICHESS SEARCH ── */}
      <section
        id="lichess"
        style={{
          padding: "32px 24px 48px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <SectionHeader
          eyebrow={platform === "chesscom" ? "Chess.com" : "Lichess"}
          title="Search any player"
          subtitle="Pick a platform, type a username, and see ratings, games, and openings."
        />

        {/* Platform toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <PlatformPill
            active={platform === "chesscom"}
            onClick={() => setPlatform("chesscom")}
            label="Chess.com"
          />
          <PlatformPill
            active={platform === "lichess"}
            onClick={() => setPlatform("lichess")}
            label="Lichess"
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(usernameInput);
          }}
          style={{
            display: "flex",
            gap: 10,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder={
              platform === "chesscom"
                ? "Enter Chess.com username..."
                : "Enter Lichess username..."
            }
            style={{
              flex: 1,
              minWidth: 240,
              background: "transparent",
              border: "none",
              padding: "12px 14px",
              color: C.text,
              fontSize: 16,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={searchLoading}
            style={{
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0 22px",
              minHeight: 44,
              fontSize: 14,
              fontWeight: 600,
              cursor: searchLoading ? "wait" : "pointer",
              opacity: searchLoading ? 0.7 : 1,
            }}
          >
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </form>

        {searchError && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {searchError}
          </div>
        )}

        {platform === "lichess" && profile && (
          <>
            <PlayerCard profile={profile} />
            <RatingGrid profile={profile} />
            <RecentGamesTable
              games={lichessGames}
              you={profile.username}
              onSelect={(g) => {
                if (g.moves) {
                  const title = `${g.players.white.user?.name ?? "?"} vs ${g.players.black.user?.name ?? "?"}`;
                  loadGameFromMoves(g.moves, title);
                  scrollTo("board");
                }
              }}
            />
          </>
        )}

        {platform === "chesscom" && chesscomProfile && (
          <>
            <ChesscomPlayerCard profile={chesscomProfile} />
            <ChesscomRatingGrid stats={chesscomStats} />
            <ChesscomGamesTable
              games={chesscomGames}
              you={chesscomProfile.username}
              onSelect={(g) => {
                const title = `${g.white.username} vs ${g.black.username}`;
                loadGameFromPgn(g.pgn, title);
                scrollTo("board");
              }}
            />
          </>
        )}
      </section>

      {/* ── BOARD ── */}
      <section
        id="board"
        style={{
          padding: "32px 24px 48px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <SectionHeader
          eyebrow="Board"
          title="Play, analyze, review"
          subtitle="Play against a built-in AI, analyze any position, or step through your games."
        />
        <BoardCard
          fen={currentFen}
          mode={mode}
          onDrop={onPieceDrop}
          reviewMoves={reviewMoves}
          reviewIdx={reviewIdx}
          setReviewIdx={setReviewIdx}
          reviewTitle={reviewTitle}
          currentOpening={currentOpening}
          openingFreq={openingFreq}
          onStartPlay={startPlayVsAi}
          onResetFree={resetFree}
          onExitReview={exitReview}
          onSuggest={suggestBestMove}
          aiHint={aiHint}
          aiThinking={aiThinking}
          aiDepth={aiDepth}
          setAiDepth={setAiDepth}
          playUserColor={playUserColor}
          gameOverMsg={gameOverMsg}
        />
      </section>

      {/* ── PGN IMPORT ── */}
      <section
        id="import"
        style={{
          padding: "32px 24px 48px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <SectionHeader
          eyebrow="Import"
          title="Import from Chess.com"
          subtitle="Export your archive as a PGN file and drop it in."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: C.accentDim,
                  border: `1px solid ${C.accent}`,
                  color: C.accentBright,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  marginBottom: 10,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 20,
          }}
        >
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
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: C.accent,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "11px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Upload PGN file
            </button>
            <span style={{ color: C.textDim, fontSize: 13 }}>
              {importedGames.length
                ? `${importedGames.length} game${importedGames.length === 1 ? "" : "s"} imported`
                : "No file selected"}
            </span>
          </div>
          {importErr && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
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
                  g={g}
                  onClick={() => {
                    loadGameFromPgn(g.pgn, `${g.white} vs ${g.black}`);
                    scrollTo("board");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        style={{
          padding: "32px 24px 64px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <SectionHeader eyebrow="Features" title="Everything you need to get better" subtitle="" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 22,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: C.accentDim,
                  border: `1px solid ${C.accent}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  marginBottom: 14,
                }}
              >
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "28px 24px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: 13,
        }}
      >
        ChessCoach by Nexyru · Free forever ·{" "}
        <a href="/" style={{ color: C.textDim, textDecoration: "none" }}>
          nexyru.com
        </a>
      </footer>

      {/* responsive helpers + live pulse */}
      <style jsx global>{`
        @media (max-width: 760px) {
          .cc-hero-grid {
            grid-template-columns: 1fr !important;
          }
          .cc-hero-h1 {
            font-size: 38px !important;
          }
          .cc-nav-links {
            display: none !important;
          }
          .cc-board-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes cc-pulse {
          0%,
          100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(74, 103, 65, 0.6);
          }
          50% {
            opacity: 0.6;
            box-shadow: 0 0 0 6px rgba(74, 103, 65, 0);
          }
        }
        .cc-live-dot {
          animation: cc-pulse 2s infinite;
        }
      `}</style>
    </div>
  );
}

// ───────────────────────── helpers UI ─────────────────────────
const navLink: React.CSSProperties = {
  color: C.textDim,
  textDecoration: "none",
  fontSize: 13.5,
  fontWeight: 500,
  transition: "color 150ms",
};

const STEPS = [
  { title: "Go to chess.com/games", desc: "Sign in and open your games list." },
  { title: "Click Archive", desc: "Switch to your archive view." },
  { title: "Export PGN", desc: "Use Download → PGN to grab a file." },
  { title: "Upload here", desc: "Drop the file into the uploader below." },
];

const FEATURES = [
  {
    icon: "🔍",
    title: "Lichess Integration",
    desc: "Search any Lichess username and instantly see their full stats and game history.",
  },
  {
    icon: "🤖",
    title: "AI Move Analysis",
    desc: "Get the best move and coaching explanation for any position.",
  },
  {
    icon: "📖",
    title: "Game Review",
    desc: "Step through your games move by move and find your mistakes.",
  },
];

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          color: C.accentBright,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ margin: "6px 0 0", color: C.textDim, fontSize: 14.5 }}>{subtitle}</p>
      )}
    </div>
  );
}

function MiniBoard() {
  // 4x4 micro layout for a decorative hero illustration
  const layout: (string | null)[][] = [
    ["♜", "♞", "♝", "♛"],
    ["♟", "♟", "♟", "♟"],
    [null, null, null, null],
    ["♙", "♙", "♙", "♙"],
  ];
  return (
    <div
      style={{
        width: 240,
        height: 240,
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        padding: 10,
        background: C.card,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: "repeat(4, 1fr)",
        gap: 0,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
      }}
      aria-hidden
    >
      {layout.flatMap((row, r) =>
        row.map((piece, f) => {
          const dark = (r + f) % 2 === 1;
          const isBlackPiece = piece && "♜♞♝♛♚♟".includes(piece);
          return (
            <div
              key={`${r}-${f}`}
              style={{
                background: dark ? C.squareDark : C.squareLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 38,
                lineHeight: 1,
                color: isBlackPiece ? "#1a1a1a" : "#fff",
                textShadow: isBlackPiece ? "none" : "0 1px 2px rgba(0,0,0,0.35)",
              }}
            >
              {piece}
            </div>
          );
        }),
      )}
    </div>
  );
}

function PlayerCard({ profile }: { profile: LichessProfile }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 22,
        display: "flex",
        gap: 18,
        alignItems: "center",
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `linear-gradient(135deg,${C.accent},${C.accentBright})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 22,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {initials(profile.username)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
          <span style={{ fontWeight: 700, fontSize: 20 }}>{profile.username}</span>
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
        <div style={{ marginTop: 6, color: C.textDim, fontSize: 13 }}>
          Member since {memberSince(profile.createdAt)}
          {profile.profile?.country ? ` · ${profile.profile.country}` : ""}
        </div>
        {profile.profile?.bio && (
          <div
            style={{
              marginTop: 6,
              color: C.textDim,
              fontSize: 13,
              lineHeight: 1.5,
              maxWidth: 700,
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
      {profile.url && (
        <a
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.textDim,
            textDecoration: "none",
            fontSize: 13,
            padding: "8px 14px",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          View on Lichess ↗
        </a>
      )}
    </div>
  );
}

const RATING_KINDS: { key: string; label: string }[] = [
  { key: "bullet", label: "Bullet" },
  { key: "blitz", label: "Blitz" },
  { key: "rapid", label: "Rapid" },
  { key: "classical", label: "Classical" },
  { key: "correspondence", label: "Correspondence" },
  { key: "puzzle", label: "Puzzle" },
];

function RatingGrid({ profile }: { profile: LichessProfile }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {RATING_KINDS.map((k) => {
        const p = profile.perfs?.[k.key];
        const rating = p?.rating;
        const games = p?.games ?? 0;
        return (
          <div
            key={k.key}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 16,
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
              {k.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                marginTop: 4,
                letterSpacing: "-0.01em",
                color: rating ? C.text : C.textMuted,
              }}
            >
              {rating ?? "—"}
              {p?.prov && (
                <span
                  style={{ fontSize: 11, color: C.textMuted, marginLeft: 4, fontWeight: 600 }}
                >
                  ?
                </span>
              )}
            </div>
            <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
              {games.toLocaleString()} {games === 1 ? "game" : "games"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentGamesTable({
  games,
  you,
  onSelect,
}: {
  games: LichessGame[];
  you: string;
  onSelect: (g: LichessGame) => void;
}) {
  if (!games.length) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          color: C.textMuted,
          fontSize: 13,
        }}
      >
        No recent games found.
      </div>
    );
  }
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "70px 1fr 1fr 80px 90px",
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 700,
          color: C.textMuted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span>Result</span>
        <span>Players</span>
        <span>Opening</span>
        <span>Time</span>
        <span style={{ textAlign: "right" }}>Date</span>
      </div>
      {games.map((g, i) => {
        const result = gameResultForUser(g, you);
        const youWhite = g.players.white.user?.name?.toLowerCase() === you.toLowerCase();
        const oppPlayer = youWhite ? g.players.black : g.players.white;
        const oppName =
          oppPlayer.user?.name ??
          (oppPlayer.aiLevel ? `Stockfish lvl ${oppPlayer.aiLevel}` : "anon");
        const resultColor = result === "W" ? C.green : result === "L" ? C.red : C.textDim;
        return (
          <button
            key={g.id}
            onClick={() => onSelect(g)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "70px 1fr 1fr 80px 90px",
              padding: "12px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              fontSize: 13.5,
              alignItems: "center",
              width: "100%",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.card2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: resultColor, fontWeight: 800 }}>{result}</span>
            <span style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>vs {oppName}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                {youWhite ? "white" : "black"}
                {oppPlayer.rating ? ` · opp ${oppPlayer.rating}` : ""}
              </div>
            </span>
            <span style={{ color: C.textDim, minWidth: 0 }}>
              {g.opening?.name ?? g.variant ?? "—"}
            </span>
            <span
              style={{
                color: C.textMuted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {g.speed ?? g.perf ?? ""}
            </span>
            <span style={{ color: C.textDim, fontSize: 12, textAlign: "right" }}>
              {fmtDate(g.createdAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlatformPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.accentDim : "transparent",
        color: active ? C.accentBright : C.textDim,
        border: `1px solid ${active ? C.accent : C.border}`,
        borderRadius: 999,
        padding: "7px 16px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 150ms, color 150ms, border-color 150ms",
      }}
    >
      {label}
    </button>
  );
}

function ChesscomPlayerCard({ profile }: { profile: ChesscomProfile }) {
  const code = chesscomCountryCode(profile.country);
  const flag = countryFlag(code);
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 22,
        display: "flex",
        gap: 18,
        alignItems: "center",
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      {profile.avatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={profile.avatar}
          alt={profile.username}
          width={64}
          height={64}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            border: `1px solid ${C.border}`,
          }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `linear-gradient(135deg,${C.accent},${C.accentBright})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 22,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials(profile.username)}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
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
          <span style={{ fontWeight: 700, fontSize: 20 }}>{profile.username}</span>
          {flag && (
            <span style={{ fontSize: 18 }} title={code ?? ""}>
              {flag}
            </span>
          )}
          {profile.status && (
            <span
              style={{
                fontSize: 11,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              · {profile.status}
            </span>
          )}
        </div>
        <div style={{ marginTop: 6, color: C.textDim, fontSize: 13 }}>
          {profile.name ? `${profile.name} · ` : ""}
          Member since {memberSince(profile.joined ? profile.joined * 1000 : undefined)}
          {profile.last_online
            ? ` · Last online ${fmtDate(profile.last_online * 1000)}`
            : ""}
        </div>
      </div>
      {profile.url && (
        <a
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.textDim,
            textDecoration: "none",
            fontSize: 13,
            padding: "8px 14px",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          View on Chess.com ↗
        </a>
      )}
    </div>
  );
}

const CHESSCOM_RATING_KINDS: { key: keyof ChesscomStats; label: string }[] = [
  { key: "chess_bullet", label: "Bullet" },
  { key: "chess_blitz", label: "Blitz" },
  { key: "chess_rapid", label: "Rapid" },
  { key: "chess_daily", label: "Daily" },
];

function ChesscomRatingGrid({ stats }: { stats: ChesscomStats | null }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {CHESSCOM_RATING_KINDS.map((k) => {
        const t = stats?.[k.key] as ChesscomTimeStats | undefined;
        const rating = t?.last?.rating;
        const r = t?.record;
        return (
          <div
            key={k.key as string}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 16,
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
              {k.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                marginTop: 4,
                letterSpacing: "-0.01em",
                color: rating ? C.text : C.textMuted,
              }}
            >
              {rating ?? "—"}
            </div>
            {r ? (
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11 }}>
                <span style={{ color: C.green }}>{r.win ?? 0}W</span>
                <span style={{ color: C.red }}>{r.loss ?? 0}L</span>
                <span style={{ color: C.textDim }}>{r.draw ?? 0}D</span>
              </div>
            ) : (
              <div style={{ color: C.textMuted, fontSize: 11, marginTop: 8 }}>No record</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChesscomGamesTable({
  games,
  you,
  onSelect,
}: {
  games: ChesscomGame[];
  you: string;
  onSelect: (g: ChesscomGame) => void;
}) {
  if (!games.length) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          color: C.textMuted,
          fontSize: 13,
        }}
      >
        No recent games found in the latest archive.
      </div>
    );
  }
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "70px 1fr 1fr 80px 90px",
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 700,
          color: C.textMuted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span>Result</span>
        <span>Players</span>
        <span>Opening</span>
        <span>Time</span>
        <span style={{ textAlign: "right" }}>Date</span>
      </div>
      {games.map((g, i) => {
        const result = chesscomGameResult(g, you);
        const youWhite = g.white.username?.toLowerCase() === you.toLowerCase();
        const opp = youWhite ? g.black : g.white;
        const resultColor = result === "W" ? C.green : result === "L" ? C.red : C.textDim;
        const opening = chesscomOpeningFromPgn(g.pgn) ?? "—";
        return (
          <button
            key={i}
            onClick={() => onSelect(g)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "70px 1fr 1fr 80px 90px",
              padding: "12px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              fontSize: 13.5,
              alignItems: "center",
              width: "100%",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.card2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: resultColor, fontWeight: 800 }}>{result}</span>
            <span style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>vs {opp.username}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                {youWhite ? "white" : "black"}
                {opp.rating ? ` · opp ${opp.rating}` : ""}
              </div>
            </span>
            <span
              style={{
                color: C.textDim,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {opening}
            </span>
            <span
              style={{
                color: C.textMuted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {g.time_class ?? ""}
            </span>
            <span style={{ color: C.textDim, fontSize: 12, textAlign: "right" }}>
              {g.end_time ? fmtDate(g.end_time * 1000) : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ImportedRow({ g, onClick }: { g: ImportedGame; onClick: () => void }) {
  const resultColor =
    g.result === "1-0"
      ? C.green
      : g.result === "0-1"
        ? C.red
        : g.result === "1/2-1/2"
          ? C.textDim
          : C.textMuted;
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        background: C.card2,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        alignItems: "center",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a3a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
    >
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {g.white} <span style={{ color: C.textMuted, fontWeight: 400 }}>vs</span> {g.black}
        </div>
        <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>{g.opening ?? "—"}</div>
      </span>
      <span style={{ color: resultColor, fontWeight: 700, fontSize: 13 }}>{g.result}</span>
      <span style={{ fontSize: 12, color: C.textDim }}>{g.date ?? ""}</span>
    </button>
  );
}

interface BoardCardProps {
  fen: string;
  mode: Mode;
  onDrop: (a: { sourceSquare: string; targetSquare: string | null }) => boolean;
  reviewMoves: { san: string; fen: string }[];
  reviewIdx: number;
  setReviewIdx: (i: number | ((p: number) => number)) => void;
  reviewTitle: string;
  currentOpening: string | null;
  openingFreq: { map: Map<string, number>; total: number };
  onStartPlay: (color: "w" | "b") => void;
  onResetFree: () => void;
  onExitReview: () => void;
  onSuggest: () => void;
  aiHint: BestMove | null;
  aiThinking: boolean;
  aiDepth: number;
  setAiDepth: (d: number) => void;
  playUserColor: "w" | "b";
  gameOverMsg: string | null;
}

function BoardCard(props: BoardCardProps) {
  const {
    fen,
    mode,
    onDrop,
    reviewMoves,
    reviewIdx,
    setReviewIdx,
    reviewTitle,
    currentOpening,
    openingFreq,
    onStartPlay,
    onResetFree,
    onExitReview,
    onSuggest,
    aiHint,
    aiThinking,
    aiDepth,
    setAiDepth,
    playUserColor,
    gameOverMsg,
  } = props;

  const total = openingFreq.total;
  const count = currentOpening ? openingFreq.map.get(currentOpening) ?? 0 : 0;
  const pct = total > 0 && count > 0 ? Math.round((count / total) * 100) : null;

  const arrows = aiHint
    ? [{ startSquare: aiHint.from, endSquare: aiHint.to, color: C.accentBright }]
    : [];

  return (
    <div
      className="cc-board-grid"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 20,
        display: "grid",
        gridTemplateColumns: "minmax(280px, 480px) 1fr",
        gap: 24,
      }}
    >
      <div>
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 10,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
          }}
        >
          <Chessboard
            options={{
              position: fen,
              boardOrientation: mode === "play" && playUserColor === "b" ? "black" : "white",
              boardStyle: { width: "100%", height: "100%" },
              darkSquareStyle: { backgroundColor: C.squareDark },
              lightSquareStyle: { backgroundColor: C.squareLight },
              animationDurationInMs: 180,
              allowDragging: mode !== "review",
              onPieceDrop: onDrop,
              arrows,
              showNotation: true,
            }}
          />
        </div>
        {mode === "review" && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center" }}>
            <NavBtn onClick={() => setReviewIdx(0)} label="⏮" disabled={reviewIdx === 0} />
            <NavBtn
              onClick={() => setReviewIdx((i) => Math.max(0, i - 1))}
              label="◀"
              disabled={reviewIdx === 0}
            />
            <NavBtn
              onClick={() => setReviewIdx((i) => Math.min(reviewMoves.length, i + 1))}
              label="▶"
              disabled={reviewIdx >= reviewMoves.length}
            />
            <NavBtn
              onClick={() => setReviewIdx(reviewMoves.length)}
              label="⏭"
              disabled={reviewIdx >= reviewMoves.length}
            />
          </div>
        )}
        {mode === "review" && (
          <div style={{ textAlign: "center", color: C.textMuted, fontSize: 11, marginTop: 8 }}>
            Use ← / → to step through moves
          </div>
        )}
      </div>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Mode bar */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <ModePill active={mode === "free"} onClick={onResetFree} label="Analyze" />
          <ModePill
            active={mode === "play"}
            onClick={() => onStartPlay("w")}
            label="Play as White"
          />
          <ModePill
            active={mode === "play" && playUserColor === "b"}
            onClick={() => onStartPlay("b")}
            label="Play as Black"
          />
          {mode === "review" && (
            <ModePill active onClick={onExitReview} label="Exit review" />
          )}
        </div>

        {/* Opening pill (dynamic) */}
        {currentOpening && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(74,103,65,0.2)",
              border: `1px solid ${C.accent}`,
              borderRadius: 8,
              fontSize: 13,
              color: "#86a97d",
              fontWeight: 600,
            }}
          >
            Opening: {currentOpening}
            {pct !== null && (
              <span style={{ color: C.textDim, fontWeight: 400, marginLeft: 8 }}>
                · you play it {pct}% of recent games
              </span>
            )}
          </div>
        )}

        {/* Title row */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {mode === "review"
              ? reviewTitle || "Game review"
              : mode === "play"
                ? `Playing AI · You are ${playUserColor === "w" ? "white" : "black"}`
                : "Analyze position"}
          </div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2 }}>
            {mode === "review"
              ? `Move ${reviewIdx} of ${reviewMoves.length}`
              : aiThinking
                ? "AI thinking..."
                : gameOverMsg ?? "Drag pieces to make moves."}
          </div>
        </div>

        {/* AI controls */}
        {mode !== "review" && (
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
                color: C.textMuted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              AI
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={onSuggest}
                disabled={aiThinking}
                style={{
                  background: C.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: aiThinking ? "wait" : "pointer",
                  opacity: aiThinking ? 0.7 : 1,
                }}
              >
                {aiThinking ? "Thinking..." : "Suggest best move"}
              </button>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: C.textDim,
                  fontSize: 12,
                }}
              >
                Depth
                <select
                  value={aiDepth}
                  onChange={(e) => setAiDepth(Number(e.target.value))}
                  style={{
                    background: C.card,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 12,
                  }}
                >
                  <option value={2}>2 (fast)</option>
                  <option value={3}>3</option>
                  <option value={4}>4 (default)</option>
                  <option value={5}>5 (slow)</option>
                </select>
              </label>
            </div>
            {aiHint && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <span style={{ color: C.textDim }}>Best move: </span>
                <span style={{ fontWeight: 700 }}>{aiHint.san}</span>
                <span style={{ color: C.textMuted, marginLeft: 8 }}>
                  ({(aiHint.score / 100).toFixed(2)})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Move list (review only) */}
        {mode === "review" && reviewMoves.length > 0 && (
          <div
            style={{
              background: C.card2,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 12,
              maxHeight: 320,
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12.5,
              lineHeight: 1.9,
            }}
          >
            {pairMoves(reviewMoves).map((pair, i) => (
              <span key={i} style={{ marginRight: 12 }}>
                <span style={{ color: C.textMuted, marginRight: 4 }}>{i + 1}.</span>
                <span
                  onClick={() => setReviewIdx(i * 2 + 1)}
                  style={{
                    cursor: "pointer",
                    color: reviewIdx === i * 2 + 1 ? C.accentBright : C.text,
                    fontWeight: reviewIdx === i * 2 + 1 ? 700 : 500,
                    marginRight: 6,
                  }}
                >
                  {pair[0].san}
                </span>
                {pair[1] && (
                  <span
                    onClick={() => setReviewIdx(i * 2 + 2)}
                    style={{
                      cursor: "pointer",
                      color: reviewIdx === i * 2 + 2 ? C.accentBright : C.text,
                      fontWeight: reviewIdx === i * 2 + 2 ? 700 : 500,
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

function ModePill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.accent : C.card2,
        color: active ? "#fff" : C.text,
        border: `1px solid ${active ? C.accent : C.border}`,
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 150ms, border-color 150ms",
      }}
    >
      {label}
    </button>
  );
}

function pairMoves(moves: { san: string; fen: string }[]) {
  const pairs: [{ san: string; fen: string }, { san: string; fen: string } | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);
  return pairs;
}

function describeGameOver(chess: Chess): string {
  if (chess.isCheckmate()) {
    const loser = chess.turn() === "w" ? "White" : "Black";
    return `Checkmate — ${loser} loses.`;
  }
  if (chess.isStalemate()) return "Stalemate.";
  if (chess.isThreefoldRepetition()) return "Draw by repetition.";
  if (chess.isInsufficientMaterial()) return "Draw — insufficient material.";
  if (chess.isDraw()) return "Draw.";
  return "Game over.";
}
