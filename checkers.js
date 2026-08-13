const SIZE = 8;

const DIRS = {
  player: [
    [-1, -1],
    [-1, 1],
  ],
  bot: [
    [1, -1],
    [1, 1],
  ],
  king: [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
};

const els = {
  board: document.getElementById("board"),
  status: document.getElementById("checkersStatus"),
  playerCount: document.getElementById("playerCount"),
  botCount: document.getElementById("botCount"),
  newGameBtn: document.getElementById("newGameBtn"),
  difficultyTabs: document.querySelectorAll("#difficultyTabs .method-tab"),
};

const DIFFICULTY_KEY = "checkersDifficulty";
const SEARCH_DEPTH = { medium: 3, hard: 6 };

let checkersDifficulty = localStorage.getItem(DIFFICULTY_KEY) || "medium";
if (!["easy", "medium", "hard"].includes(checkersDifficulty)) checkersDifficulty = "medium";

els.difficultyTabs.forEach((tab) => {
  tab.classList.toggle("active", tab.dataset.difficulty === checkersDifficulty);
  tab.addEventListener("click", () => {
    checkersDifficulty = tab.dataset.difficulty;
    localStorage.setItem(DIFFICULTY_KEY, checkersDifficulty);
    els.difficultyTabs.forEach((t) => t.classList.toggle("active", t === tab));
  });
});

let board = null;
let playerTurn = true;
let selected = null;
let gameOver = false;
let busy = false;

function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function createBoard() {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) b[r][c] = { owner: "bot", king: false };
    }
  }
  for (let r = 5; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) b[r][c] = { owner: "player", king: false };
    }
  }
  return b;
}

function getMovesForPiece(b, r, c) {
  const piece = b[r][c];
  if (!piece) return { simple: [], captures: [] };
  const dirs = piece.king ? DIRS.king : DIRS[piece.owner];
  const simple = [];
  const captures = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && !b[nr][nc]) {
      simple.push({ from: [r, c], to: [nr, nc] });
    }
    const jr = r + dr * 2;
    const jc = c + dc * 2;
    if (
      inBounds(jr, jc) &&
      inBounds(nr, nc) &&
      b[nr][nc] &&
      b[nr][nc].owner !== piece.owner &&
      !b[jr][jc]
    ) {
      captures.push({ from: [r, c], to: [jr, jc], captured: [nr, nc] });
    }
  }
  return { simple, captures };
}

function getAllMoves(b, owner) {
  const allCaptures = [];
  const allSimple = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] && b[r][c].owner === owner) {
        const { simple, captures } = getMovesForPiece(b, r, c);
        allCaptures.push(...captures);
        allSimple.push(...simple);
      }
    }
  }
  return allCaptures.length
    ? { moves: allCaptures, mustCapture: true }
    : { moves: allSimple, mustCapture: false };
}

function movesFrom(moves, r, c) {
  return moves.filter((m) => m.from[0] === r && m.from[1] === c);
}

function applyMove(b, move) {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = b[fr][fc];
  b[fr][fc] = null;
  if (move.captured) b[move.captured[0]][move.captured[1]] = null;
  if ((piece.owner === "player" && tr === 0) || (piece.owner === "bot" && tr === SIZE - 1)) {
    piece.king = true;
  }
  b[tr][tc] = piece;
  return Boolean(move.captured);
}

function cloneBoard(b) {
  return b.map((row) => row.map((cell) => (cell ? { owner: cell.owner, king: cell.king } : null)));
}

function captureSequences(b, r, c) {
  const { captures } = getMovesForPiece(b, r, c);
  if (captures.length === 0) return [[]];
  const sequences = [];
  for (const move of captures) {
    const b2 = cloneBoard(b);
    applyMove(b2, move);
    const [tr, tc] = move.to;
    for (const rest of captureSequences(b2, tr, tc)) {
      sequences.push([move, ...rest]);
    }
  }
  return sequences;
}

function enumerateFullMoves(b, owner) {
  const { moves, mustCapture } = getAllMoves(b, owner);
  if (!mustCapture) return moves.map((m) => [m]);
  const sequences = [];
  for (const startMove of moves) {
    const b2 = cloneBoard(b);
    applyMove(b2, startMove);
    const [tr, tc] = startMove.to;
    for (const rest of captureSequences(b2, tr, tc)) {
      sequences.push([startMove, ...rest]);
    }
  }
  return sequences;
}

function applySequence(b, seq) {
  const b2 = cloneBoard(b);
  seq.forEach((move) => applyMove(b2, move));
  return b2;
}

function evaluateBoard(b) {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = b[r][c];
      if (!p) continue;
      let value = p.king ? 3 : 1;
      if (!p.king) {
        value += (p.owner === "bot" ? r : SIZE - 1 - r) / 21;
      }
      score += p.owner === "bot" ? value : -value;
    }
  }
  return score;
}

function minimax(b, depth, owner, alpha, beta) {
  const sequences = enumerateFullMoves(b, owner);
  if (sequences.length === 0) {
    return { score: owner === "bot" ? -1000 : 1000, seq: null };
  }
  if (depth === 0) {
    return { score: evaluateBoard(b), seq: null };
  }

  const nextOwner = owner === "bot" ? "player" : "bot";
  let bestSeq = sequences[0];

  if (owner === "bot") {
    let best = -Infinity;
    for (const seq of sequences) {
      const { score } = minimax(applySequence(b, seq), depth - 1, nextOwner, alpha, beta);
      if (score > best) {
        best = score;
        bestSeq = seq;
      }
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return { score: best, seq: bestSeq };
  }

  let best = Infinity;
  for (const seq of sequences) {
    const { score } = minimax(applySequence(b, seq), depth - 1, nextOwner, alpha, beta);
    if (score < best) {
      best = score;
      bestSeq = seq;
    }
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return { score: best, seq: bestSeq };
}

function countPieces(owner) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] && board[r][c].owner === owner) n++;
    }
  }
  return n;
}

function setStatus(text) {
  els.status.textContent = text;
}

function updateCounts() {
  els.playerCount.textContent = countPieces("player");
  els.botCount.textContent = countPieces("bot");
}

function startGame() {
  board = createBoard();
  playerTurn = true;
  selected = null;
  gameOver = false;
  busy = false;
  updateCounts();
  setStatus("Ваш ход — выберите шашку.");
  render();
}

function render() {
  els.board.innerHTML = "";

  let highlightMoves = [];
  let selectableFrom = new Set();
  if (playerTurn && !gameOver && !busy) {
    const { moves } = getAllMoves(board, "player");
    if (selected) {
      highlightMoves = movesFrom(moves, selected[0], selected[1]);
    } else {
      moves.forEach((m) => selectableFrom.add(`${m.from[0]},${m.from[1]}`));
    }
  }
  const destSet = new Set(highlightMoves.map((m) => `${m.to[0]},${m.to[1]}`));

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const sq = document.createElement("div");
      const isDark = (r + c) % 2 === 1;
      sq.className = `square ${isDark ? "dark" : "light"}`;

      if (selected && selected[0] === r && selected[1] === c) {
        sq.classList.add("selected");
      }
      if (destSet.has(`${r},${c}`)) {
        sq.classList.add("selectable");
      }
      if (!selected && selectableFrom.has(`${r},${c}`)) {
        sq.classList.add("selectable");
      }

      const piece = board[r][c];
      if (piece) {
        const p = document.createElement("div");
        p.className = `piece ${piece.owner}${piece.king ? " king" : ""}`;
        sq.appendChild(p);
      }

      sq.addEventListener("click", () => onSquareClick(r, c));
      els.board.appendChild(sq);
    }
  }
}

function onSquareClick(r, c) {
  if (!playerTurn || gameOver || busy) return;
  const { moves, mustCapture } = getAllMoves(board, "player");
  if (moves.length === 0) return;

  if (selected) {
    const candidates = movesFrom(moves, selected[0], selected[1]);
    const move = candidates.find((m) => m.to[0] === r && m.to[1] === c);
    if (move) {
      const wasCapture = applyMove(board, move);
      updateCounts();

      if (wasCapture) {
        const cont = getMovesForPiece(board, r, c).captures;
        if (cont.length) {
          selected = move.to;
          render();
          setStatus("Продолжайте бить этой шашкой.");
          return;
        }
      }
      selected = null;
      render();
      endPlayerTurn();
      return;
    }

    if (board[r][c] && board[r][c].owner === "player" && movesFrom(moves, r, c).length) {
      selected = [r, c];
      render();
      return;
    }
    return;
  }

  if (board[r][c] && board[r][c].owner === "player") {
    if (movesFrom(moves, r, c).length) {
      selected = [r, c];
      render();
    } else if (mustCapture) {
      setStatus("Обязательно бить — выберите шашку, которая может бить.");
    }
  }
}

function endPlayerTurn() {
  if (countPieces("bot") === 0) {
    endGame("Вы победили! У бота не осталось шашек. 🎉");
    return;
  }
  const botMoves = getAllMoves(board, "bot");
  if (botMoves.moves.length === 0) {
    endGame("Вы победили! У бота нет ходов. 🎉");
    return;
  }
  playerTurn = false;
  busy = true;
  render();
  setStatus("Ход бота...");
  setTimeout(runBotTurn, 600);
}

function chooseBotSequence() {
  const sequences = enumerateFullMoves(board, "bot");
  if (checkersDifficulty === "easy") {
    return sequences[Math.floor(Math.random() * sequences.length)];
  }
  const depth = SEARCH_DEPTH[checkersDifficulty] || SEARCH_DEPTH.medium;
  const { seq } = minimax(board, depth, "bot", -Infinity, Infinity);
  return seq || sequences[Math.floor(Math.random() * sequences.length)];
}

function runBotTurn() {
  const seq = chooseBotSequence();
  animateBotSequence(seq, 0);
}

function animateBotSequence(seq, i) {
  const move = seq[i];
  applyMove(board, move);
  updateCounts();
  render();

  if (i < seq.length - 1) {
    setStatus("Бот продолжает бить...");
    setTimeout(() => animateBotSequence(seq, i + 1), 550);
  } else {
    finishBotTurn();
  }
}

function finishBotTurn() {
  if (countPieces("player") === 0) {
    endGame("Бот победил. Попробуйте ещё раз.");
    return;
  }
  const playerMoves = getAllMoves(board, "player");
  if (playerMoves.moves.length === 0) {
    endGame("Бот победил — у вас нет ходов.");
    return;
  }
  playerTurn = true;
  busy = false;
  render();
  setStatus("Ваш ход — выберите шашку.");
}

function endGame(text) {
  gameOver = true;
  busy = false;
  setStatus(text);
  render();
}

els.newGameBtn.addEventListener("click", startGame);

startGame();
