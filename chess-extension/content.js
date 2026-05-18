// ChessCoach by Nexyru — content script
// Runs on chess.com game pages. Watches the move list and forwards SAN moves
// to the coach tab when one is open.
(() => {
  const COACH_ORIGIN = "https://www.nexyru.com";
  const COACH_URL = COACH_ORIGIN + "/chess?mode=live";
  const COACH_TARGET = "nexyru_chess_coach";

  /** @type {Window | null} */
  let coachWin = null;
  let lastSent = "";

  function getCoachWin() {
    // window.open with a named target reuses the existing tab if one exists.
    // It can return null if popups are blocked.
    if (coachWin && !coachWin.closed) return coachWin;
    return null;
  }

  function openCoach() {
    coachWin = window.open(COACH_URL, COACH_TARGET);
    return coachWin;
  }

  function send(moveList) {
    const payload = { type: "CHESS_COACH_UPDATE", moveList, ts: Date.now() };
    const key = JSON.stringify(payload.moveList);
    if (key === lastSent) return;
    lastSent = key;

    const w = getCoachWin();
    if (!w) return;
    try {
      w.postMessage(payload, COACH_ORIGIN);
    } catch (e) {
      // posting may fail if the tab is mid-navigation; ignore
    }
  }

  // Chess.com's DOM is volatile. Try a few selectors known to contain SAN.
  const MOVE_SELECTORS = [
    'wc-vertical-move-list [data-node-type="line"] .node-highlight-content',
    "vertical-move-list .move .node-highlight-content",
    ".move-list-wrapper .move .node-highlight-content",
    ".move-text-component",
  ];

  function extractMoves() {
    for (const sel of MOVE_SELECTORS) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > 0) {
        const moves = [];
        nodes.forEach((n) => {
          const t = (n.textContent || "").trim();
          if (t) moves.push(t);
        });
        if (moves.length > 0) return moves;
      }
    }
    return [];
  }

  const observer = new MutationObserver(() => {
    const moves = extractMoves();
    if (moves.length > 0) send(moves);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Listen for the coach acknowledging itself
  window.addEventListener("message", (e) => {
    if (e.origin !== COACH_ORIGIN) return;
    if (e.data && e.data.type === "COACH_READY" && e.source) {
      coachWin = /** @type {Window} */ (e.source);
      const moves = extractMoves();
      if (moves.length > 0) send(moves);
    }
  });

  // Expose a tiny helper for the popup-less case: a keyboard shortcut on chess.com
  // (Alt+C) opens the coach tab so the postMessage channel can attach.
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      openCoach();
    }
  });

  console.log("[ChessCoach] content script loaded. Press Alt+C to open the coach tab.");
})();
