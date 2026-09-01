const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };

function formatNumber(n) {
  return n.toLocaleString("ru-RU");
}

function isRed(suit) {
  return suit === "♥" || suit === "♦";
}

function rankLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

function cardText(card) {
  return `${rankLabel(card.rank)}${card.suit}`;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ suit, rank });
  }
  return shuffle(deck);
}

function cardBeats(defCard, atkCard, trumpSuit) {
  if (defCard.suit === atkCard.suit && defCard.rank > atkCard.rank) return true;
  if (defCard.suit === trumpSuit && atkCard.suit !== trumpSuit) return true;
  return false;
}

function cardKey(c) {
  return `${c.suit}${c.rank}`;
}

function fullDeckList() {
  const list = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) list.push({ suit, rank });
  }
  return list;
}

const els = {
  trumpDisplay: document.getElementById("trumpDisplay"),
  deckCount: document.getElementById("deckCount"),
  botCount: document.getElementById("botCount"),
  status: document.getElementById("durakStatus"),
  botHand: document.getElementById("botHand"),
  table: document.getElementById("durakTable"),
  playerHand: document.getElementById("playerHand"),
  takeBtn: document.getElementById("takeBtn"),
  bitoBtn: document.getElementById("bitoBtn"),
  giveBtn: document.getElementById("giveBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  difficultyTabs: document.querySelectorAll("#difficultyTabs .method-tab"),
};

const DIFFICULTY_KEY = "durakDifficulty";
const THROW_IN_CHANCE = { easy: 0.3, medium: 0.7, hard: 0.95 };

let botDifficulty = localStorage.getItem(DIFFICULTY_KEY) || "medium";
if (!THROW_IN_CHANCE[botDifficulty]) botDifficulty = "medium";

els.difficultyTabs.forEach((tab) => {
  tab.classList.toggle("active", tab.dataset.difficulty === botDifficulty);
  tab.addEventListener("click", () => {
    botDifficulty = tab.dataset.difficulty;
    localStorage.setItem(DIFFICULTY_KEY, botDifficulty);
    els.difficultyTabs.forEach((t) => t.classList.toggle("active", t === tab));
  });
});

function rankCounts(cards) {
  const counts = {};
  cards.forEach((c) => {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  });
  return counts;
}

let game = null;

function sortHand(hand) {
  hand.sort((a, b) => a.rank - b.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
}

function initGame() {
  const deck = createDeck();
  const trumpCard = deck[deck.length - 1];
  const player = [];
  const bot = [];
  for (let i = 0; i < 6; i++) {
    player.push(deck.shift());
    bot.push(deck.shift());
  }
  sortHand(player);

  game = {
    deck,
    trumpCard,
    trumpSuit: trumpCard.suit,
    player,
    bot,
    table: [],
    attackerIsPlayer: Math.random() < 0.5,
    busy: false,
    over: false,
    botTaking: false,
    tookCards: false,
    playerDefendedWithTrump: false,
  };

  startAttackTurn();
}

function setStatus(text) {
  els.status.textContent = text;
}

function allDefended() {
  return game.table.length > 0 && game.table.every((p) => p.defend);
}

function hasUndefended() {
  return game.table.some((p) => !p.defend);
}

function noteTableGrew() {
  if (game.table.length >= 6) unlockAchievement("durak_full_table");
}

function noteDefend(card) {
  if (card.suit === game.trumpSuit) game.playerDefendedWithTrump = true;
}

function makeCardEl(card, { faceDown = false, clickable = false, extraClass = "" } = {}) {
  const el = document.createElement("div");
  el.className = `playing-card ${extraClass}`.trim();
  if (faceDown) {
    el.classList.add("back");
  } else {
    el.classList.add(isRed(card.suit) ? "red" : "black");
    el.textContent = cardText(card);
  }
  if (clickable) el.classList.add("clickable");
  return el;
}

function render() {
  els.trumpDisplay.textContent = cardText(game.trumpCard);
  els.trumpDisplay.className = `meta-value ${isRed(game.trumpCard.suit) ? "red-text" : "black-text"}`;
  els.deckCount.textContent = game.deck.length;
  els.botCount.textContent = game.bot.length;

  els.botHand.innerHTML = "";
  game.bot.forEach(() => els.botHand.appendChild(makeCardEl(null, { faceDown: true })));

  els.table.innerHTML = "";
  if (game.table.length === 0) {
    const hint = document.createElement("div");
    hint.className = "table-empty-hint";
    hint.textContent = "Стол пуст";
    els.table.appendChild(hint);
  } else {
    game.table.forEach((pair) => {
      const wrap = document.createElement("div");
      wrap.className = "table-pair";
      wrap.appendChild(makeCardEl(pair.attack));
      if (pair.defend) {
        wrap.appendChild(makeCardEl(pair.defend, { extraClass: "defend-card" }));
      }
      els.table.appendChild(wrap);
    });
  }

  els.playerHand.innerHTML = "";
  game.player.forEach((card, index) => {
    const canClick = !game.busy && !game.over;
    const el = makeCardEl(card, { clickable: canClick });
    el.addEventListener("click", () => handlePlayerCardClick(index));
    els.playerHand.appendChild(el);
  });

  const canBito = !game.over && game.attackerIsPlayer && !game.botTaking && allDefended();
  const canTake = !game.over && !game.attackerIsPlayer && hasUndefended();
  const canGive = !game.over && game.attackerIsPlayer && game.botTaking;
  els.bitoBtn.classList.toggle("hidden", !canBito);
  els.takeBtn.classList.toggle("hidden", !canTake);
  els.giveBtn.classList.toggle("hidden", !canGive);
}

function playAttack(card, index) {
  game.table.push({ attack: card, defend: null });
  game.player.splice(index, 1);
  noteTableGrew();
  const pairIndex = game.table.length - 1;
  game.busy = true;
  render();
  setStatus("Ждём ответа бота...");
  setTimeout(() => botDefendOne(pairIndex), 600);
}

function handlePlayerCardClick(index) {
  if (game.busy || game.over) return;
  const card = game.player[index];

  if (game.attackerIsPlayer) {
    if (game.table.length === 0) {
      playAttack(card, index);
      return;
    }
    if (game.botTaking) {
      if (game.table.length >= 6) {
        setStatus("На столе уже максимум карт для этого раунда.");
        return;
      }
      const ranksOnTable = new Set(
        game.table.flatMap((p) => [p.attack.rank, p.defend ? p.defend.rank : null]).filter((r) => r !== null)
      );
      if (!ranksOnTable.has(card.rank)) {
        setStatus("Можно подкинуть только карту такого же достоинства, как на столе.");
        return;
      }
      game.table.push({ attack: card, defend: null });
      game.player.splice(index, 1);
      noteTableGrew();
      render();
      setStatus("Бот берёт карты. Подкиньте ещё или нажмите «Отдать карты боту».");
      return;
    }
    if (!allDefended()) {
      setStatus("Дождитесь хода бота.");
      return;
    }
    if (game.table.length >= 6) {
      setStatus("На столе уже максимум карт для этого раунда.");
      return;
    }
    if (game.bot.length === 0) {
      setStatus("У бота не осталось карт — нажмите «Бито», чтобы завершить раунд.");
      return;
    }
    const ranksOnTable = new Set(game.table.flatMap((p) => [p.attack.rank, p.defend.rank]));
    if (!ranksOnTable.has(card.rank)) {
      setStatus("Можно подкинуть только карту такого же достоинства, как на столе.");
      return;
    }
    playAttack(card, index);
  } else {
    const idx = game.table.findIndex((p) => !p.defend);
    if (idx === -1) return;
    const atk = game.table[idx].attack;
    if (!cardBeats(card, atk, game.trumpSuit)) {
      setStatus(`Эта карта не бьёт ${cardText(atk)}.`);
      return;
    }
    game.table[idx].defend = card;
    game.player.splice(index, 1);
    noteDefend(card);
    if (card.rank === 14) unlockAchievement("durak_ace_defend");
    game.busy = true;
    render();
    setStatus("Вы отбились. Бот думает...");
    setTimeout(botContinueAttackOrFinish, 700);
  }
}

function computeUnknownPool() {
  const used = new Set();
  game.bot.forEach((c) => used.add(cardKey(c)));
  game.table.forEach((p) => {
    used.add(cardKey(p.attack));
    if (p.defend) used.add(cardKey(p.defend));
  });
  return fullDeckList().filter((c) => !used.has(cardKey(c)));
}

function simGreedyDefendCard(hand, atk, trumpSuit) {
  const candidates = hand.filter((c) => cardBeats(c, atk, trumpSuit));
  if (!candidates.length) return null;
  return [...candidates].sort(
    (a, b) => (a.suit === trumpSuit ? 1 : 0) - (b.suit === trumpSuit ? 1 : 0) || a.rank - b.rank
  )[0];
}

function cardCost(card, trumpSuit) {
  return card.suit === trumpSuit ? 1.6 : 1;
}

// One randomized playout: the attacker (hypothetical player hand) keeps throwing
// in matching-rank cards while it can and the bot keeps covering them, until the
// round ends or the bot runs out of cards and is forced to take everything.
function simulateDefendCost(candidate, atk, trumpSuit, botHandAfterCandidate, hypPlayerHand) {
  const bot = [...botHandAfterCandidate];
  const hypPlayer = [...hypPlayerHand];
  const tableRanks = new Set([atk.rank, candidate.rank]);
  let cost = cardCost(candidate, trumpSuit);
  let tableCount = 1;

  while (bot.length > 0 && tableCount < 6) {
    const throwable = hypPlayer.filter((c) => tableRanks.has(c.rank));
    if (!throwable.length || Math.random() > 0.7) break;
    const atkCard = throwable.sort((a, b) => a.rank - b.rank)[0];
    hypPlayer.splice(hypPlayer.indexOf(atkCard), 1);
    tableCount++;

    const defCard = simGreedyDefendCard(bot, atkCard, trumpSuit);
    if (!defCard) return cost + bot.length + tableCount + 3;
    bot.splice(bot.indexOf(defCard), 1);
    tableRanks.add(defCard.rank);
    cost += cardCost(defCard, trumpSuit);
  }

  return cost;
}

// Hard mode: for each legal defending card, deal out many plausible hidden
// hands consistent with what's actually known (own hand + table), play the
// round forward on each, and keep the card with the lowest average cost.
// The bot never looks at the real player hand — only samples random ones.
function pickHardDefendCard(candidates, atk, trumpSuit) {
  if (candidates.length === 1) return candidates[0];
  const SAMPLES = 20;
  let bestCard = candidates[0];
  let bestAvg = Infinity;

  for (const candidate of candidates) {
    const botRest = game.bot.filter((c) => c !== candidate);
    let total = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const pool = shuffle(computeUnknownPool());
      const hypPlayer = pool.slice(0, game.player.length);
      total += simulateDefendCost(candidate, atk, trumpSuit, botRest, hypPlayer);
    }
    const avg = total / SAMPLES;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestCard = candidate;
    }
  }
  return bestCard;
}

function botDefendOne(pairIndex) {
  const atk = game.table[pairIndex].attack;
  const candidates = game.bot.filter((c) => cardBeats(c, atk, game.trumpSuit));
  if (candidates.length === 0) {
    game.botTaking = true;
    game.busy = false;
    setStatus("Бот не может отбиться и берёт карты. Подкиньте ещё или нажмите «Отдать карты боту».");
    render();
    return;
  }

  let chosen;
  if (botDifficulty === "easy") {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  } else if (botDifficulty === "hard") {
    chosen = pickHardDefendCard(candidates, atk, game.trumpSuit);
  } else {
    const sorted = [...candidates].sort(
      (a, b) => (a.suit === game.trumpSuit ? 1 : 0) - (b.suit === game.trumpSuit ? 1 : 0) || a.rank - b.rank
    );
    chosen = sorted[0];
  }

  game.bot.splice(game.bot.indexOf(chosen), 1);
  game.table[pairIndex].defend = chosen;
  game.busy = false;
  setStatus("Бот отбился. Подкиньте ещё карту или нажмите «Бито».");
  render();
}

function botContinueAttackOrFinish() {
  const ranksOnTable = new Set(game.table.flatMap((p) => [p.attack.rank, p.defend.rank]));
  const candidates = game.bot.filter((c) => ranksOnTable.has(c.rank));
  const canAdd = candidates.length > 0 && game.table.length < 6 && game.player.length > 0;
  const chance = THROW_IN_CHANCE[botDifficulty];

  if (canAdd && Math.random() < chance) {
    let card;
    if (botDifficulty === "easy") {
      card = candidates[Math.floor(Math.random() * candidates.length)];
    } else if (botDifficulty === "hard") {
      const counts = rankCounts(game.bot);
      card = [...candidates].sort((a, b) => counts[b.rank] - counts[a.rank] || a.rank - b.rank)[0];
    } else {
      card = [...candidates].sort((a, b) => a.rank - b.rank)[0];
    }
    game.bot.splice(game.bot.indexOf(card), 1);
    game.table.push({ attack: card, defend: null });
    game.busy = false;
    setStatus("Бот подкинул ещё карту.");
    render();
  } else {
    finishRoundBito();
  }
}

function botAttack() {
  let card;
  if (botDifficulty === "easy") {
    card = game.bot[Math.floor(Math.random() * game.bot.length)];
  } else {
    const nonTrump = game.bot.filter((c) => c.suit !== game.trumpSuit);
    const pool = nonTrump.length ? nonTrump : game.bot;
    if (botDifficulty === "hard") {
      const counts = rankCounts(pool);
      card = [...pool].sort((a, b) => counts[b.rank] - counts[a.rank] || a.rank - b.rank)[0];
    } else {
      card = [...pool].sort((a, b) => a.rank - b.rank)[0];
    }
  }
  game.bot.splice(game.bot.indexOf(card), 1);
  game.table.push({ attack: card, defend: null });
  game.busy = false;
  setStatus(`Бот пошёл с ${cardText(card)}. Отбейтесь или возьмите карты.`);
  render();
}

function botTakesAll() {
  game.bot.push(...game.table.flatMap((p) => [p.attack, p.defend].filter(Boolean)));
  game.table = [];
  game.botTaking = false;
  setStatus("Бот забирает карты со стола.");
  render();
  drawPhase(["player"]);
  if (finishIfGameOver()) return;
  game.busy = false;
  startAttackTurn();
}

function finishRoundBito() {
  const roundAttackerIsPlayer = game.attackerIsPlayer;
  game.table = [];
  game.attackerIsPlayer = !roundAttackerIsPlayer;
  drawPhase(roundAttackerIsPlayer ? ["player", "bot"] : ["bot", "player"]);
  if (finishIfGameOver()) return;
  game.busy = false;
  startAttackTurn();
}

function drawPhase(order) {
  order.forEach((who) => {
    const hand = who === "player" ? game.player : game.bot;
    while (hand.length < 6 && game.deck.length > 0) {
      hand.push(game.deck.shift());
    }
    if (who === "player") sortHand(game.player);
  });
}

function finishIfGameOver() {
  if (game.deck.length > 0) return false;
  if (game.player.length === 0 && game.bot.length === 0) {
    endGame("Ничья! Карты закончились одновременно.", "draw");
    return true;
  }
  if (game.player.length === 0) {
    endGame("Вы победили! Бот остался Дураком. 🎉", "win");
    return true;
  }
  if (game.bot.length === 0) {
    endGame("Бот победил. Вы — Дурак 🃏", "loss");
    return true;
  }
  return false;
}

function endGame(text, outcome) {
  game.over = true;
  setStatus(text);
  if (outcome) {
    recordGameResult("durak", botDifficulty, outcome);
    if (achBump("durakGamesPlayed") >= 10) unlockAchievement("durak_marathon");
  }
  if (outcome === "draw") unlockAchievement("durak_draw");
  if (outcome === "win") {
    unlockAchievement("durak_first_win");
    if (botDifficulty === "medium") unlockAchievement("durak_win_medium");
    if (botDifficulty === "hard") unlockAchievement("durak_win_hard");
    achSetFlag(`durakWin_${botDifficulty}`, true);
    if (achGetFlag("durakWin_easy") && achGetFlag("durakWin_medium") && achGetFlag("durakWin_hard")) {
      unlockAchievement("durak_all_difficulties");
    }
    if (!game.tookCards) unlockAchievement("durak_no_take");
    if (!game.playerDefendedWithTrump) unlockAchievement("durak_no_trump_win");
  }
  render();
}

function startAttackTurn() {
  render();
  if (game.attackerIsPlayer) {
    setStatus("Ваш ход — выберите карту для атаки.");
  } else {
    setStatus("Ход бота — атакует...");
    game.busy = true;
    setTimeout(botAttack, 700);
  }
}

function botThrowInBeforePlayerTake() {
  const ranksOnTable = new Set(
    game.table.flatMap((p) => [p.attack.rank, p.defend ? p.defend.rank : null]).filter((r) => r !== null)
  );
  const candidates = game.bot.filter((c) => ranksOnTable.has(c.rank));
  const canAdd = candidates.length > 0 && game.table.length < 6;
  const chance = THROW_IN_CHANCE[botDifficulty];

  if (canAdd && Math.random() < chance) {
    let card;
    if (botDifficulty === "easy") {
      card = candidates[Math.floor(Math.random() * candidates.length)];
    } else if (botDifficulty === "hard") {
      const counts = rankCounts(game.bot);
      card = [...candidates].sort((a, b) => counts[b.rank] - counts[a.rank] || a.rank - b.rank)[0];
    } else {
      card = [...candidates].sort((a, b) => a.rank - b.rank)[0];
    }
    game.bot.splice(game.bot.indexOf(card), 1);
    game.table.push({ attack: card, defend: null });
    render();
    setStatus("Бот подкидывает ещё карту, прежде чем вы заберёте...");
    setTimeout(botThrowInBeforePlayerTake, 500);
  } else {
    finalizePlayerTake();
  }
}

function finalizePlayerTake() {
  game.tookCards = true;
  game.player.push(...game.table.flatMap((p) => [p.attack, p.defend].filter(Boolean)));
  game.table = [];
  sortHand(game.player);
  setStatus("Вы забрали карты.");
  render();
  drawPhase(["bot"]);
  if (finishIfGameOver()) return;
  game.busy = false;
  startAttackTurn();
}

els.takeBtn.addEventListener("click", () => {
  if (game.busy || game.over) return;
  game.busy = true;
  render();
  botThrowInBeforePlayerTake();
});

els.bitoBtn.addEventListener("click", () => {
  if (game.busy || game.over) return;
  game.busy = true;
  finishRoundBito();
});

els.giveBtn.addEventListener("click", () => {
  if (game.busy || game.over || !game.botTaking) return;
  game.busy = true;
  botTakesAll();
});

els.newGameBtn.addEventListener("click", () => {
  initGame();
});

initStatsPanel("durak");
initGame();
