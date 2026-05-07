// lib/ai/feedback.ts
// ── Rule-based feedback engine ────────────────────────────────

export interface TradeData {
  id:         string;
  pair:       string;
  type:       "long" | "short";
  pnl:        number;
  pnlPercent: number;
}

export interface NotesData {
  setup:          string | null;
  confidence:     number;
  emotion:        string;
  notes:          string | null;
  followed_rules: boolean;
}

export interface MistakeData {
  name: string;
}

export interface FeedbackResult {
  feedback: string;
  score:    number;
  lines:    string[];
}

export function generateFeedback(
  trade:        TradeData,
  notes:        NotesData,
  mistakes:     MistakeData[],
  recentTrades: TradeData[]
): FeedbackResult {
  let score = 100;
  const lines: string[] = [];
  const mistakeNames = mistakes.map(m => m.name.toLowerCase());
  const isLoss = trade.pnl < 0;

  // ── Rule 1: Revenge trading ──────────────────────────────
  if (mistakeNames.some(m => m.includes("revenge"))) {
    score -= 30;
    lines.push("⚠️ You are showing revenge trading behaviour. Revenge trades bypass your process and almost always make losses worse. Step away before your next entry.");
  }

  // ── Rule 2: Overconfidence on a losing trade ─────────────
  if (notes.confidence >= 8 && isLoss) {
    score -= 20;
    lines.push(`📉 You rated your confidence ${notes.confidence}/10 but the trade lost. High confidence without edge is overconfidence — review what your setup was actually telling you.`);
  }

  // ── Rule 3: Broke rules ───────────────────────────────────
  if (!notes.followed_rules) {
    score -= 25;
    lines.push("🚨 You broke your trading rules on this trade. Rule violations are your biggest long-term performance leak — every exception trains your brain that rules are optional.");
  }

  // ── Rule 4: Moved stop loss ───────────────────────────────
  if (mistakeNames.some(m => m.includes("moved stop"))) {
    score -= 20;
    lines.push("🛑 You moved your stop loss. This negates your risk management entirely. Set it and leave it — the market doesn't care where you placed it.");
  }

  // ── Rule 5: FOMO ─────────────────────────────────────────
  if (notes.emotion === "fomo") {
    score -= 15;
    lines.push("😰 You were in a FOMO state when you entered. FOMO trades are historically your worst-performing setups — the move you are chasing is usually already over.");
  }

  // ── Rule 6: Losing streak ────────────────────────────────
  const recentLosses = recentTrades.slice(0, 5).filter(t => t.pnl < 0).length;
  if (recentLosses >= 3 && isLoss) {
    score -= 15;
    lines.push(`🔴 You have lost ${recentLosses} of your last 5 trades. You may be in a performance slump — consider reducing size or pausing until your edge re-appears.`);
  }

  // ── Rule 7: No clear setup ───────────────────────────────
  if (mistakeNames.some(m => m.includes("no clear setup"))) {
    score -= 20;
    lines.push("❓ This trade had no clear setup. Random entries produce random results — only trade when all your criteria are met.");
  }

  // ── Rule 8: Overleveraged ────────────────────────────────
  if (mistakeNames.some(m => m.includes("overleverag"))) {
    score -= 15;
    lines.push("⚡ You were overleveraged. Position sizing is the single most controllable variable in trading — keep it consistent.");
  }

  // ── Rule 9: Revenge + Loss (compound penalty) ────────────
  if (notes.emotion === "revenge" && isLoss) {
    score -= 10;
    lines.push("🔁 Emotional state was revenge AND the trade lost. This pattern is extremely destructive — build a rule that prevents any trade within 30 minutes of a loss.");
  }

  // ── Positive feedback ─────────────────────────────────────
  if (mistakes.length === 0 && notes.followed_rules && !isLoss) {
    lines.push("✅ Clean trade. No mistakes logged, rules followed, profitable result. This is exactly the process you want to repeat.");
  }

  if (mistakes.length === 0 && notes.followed_rules && isLoss) {
    lines.push("👍 Good process despite the loss. You followed your rules and made no mistakes — losses happen even with perfect execution. Keep the process.");
  }

  // ── Summary line ──────────────────────────────────────────
  const clampedScore = Math.max(0, Math.min(100, score));
  const label = clampedScore >= 80 ? "Strong execution" : clampedScore >= 50 ? "Needs improvement" : "Critical issues";
  lines.unshift(`**Process Score: ${clampedScore}/100 — ${label}**\n`);

  return {
    feedback: lines.join("\n\n"),
    score:    clampedScore,
    lines,
  };
}

// ── Stub for future OpenAI integration ───────────────────────
// lib/ai/openai.ts
export async function generateAdvancedFeedback(_trades: TradeData[]): Promise<string> {
  // TODO: implement with OpenAI when ready
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await openai.chat.completions.create({ ... });
  throw new Error("OpenAI integration not yet implemented");
}