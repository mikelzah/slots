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
  newGameBtn: document.getElementById("newGameBtn"),
};

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

  const canBito = !game.over && game.attackerIsPlayer && allDefended();
  const canTake = !game.over && !game.attackerIsPlayer && hasUndefended();
  els.bitoBtn.classList.toggle("hidden", !canBito);
  els.takeBtn.classList.toggle("hidden", !canTake);
}

function playAttack(card, index) {
  game.table.push({ attack: card, defend: null });
  game.player.splice(index, 1);
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
    game.busy = true;
    render();
    setStatus("Вы отбились. Бот думает...");
    setTimeout(botContinueAttackOrFinish, 700);
  }
}

function botDefendOne(pairIndex) {
  const atk = game.table[pairIndex].attack;
  const candidates = game.bot.filter((c) => cardBeats(c, atk, game.trumpSuit));
  if (candidates.length === 0) {
    botTakesAll();
    return;
  }
  candidates.sort(
    (a, b) => (a.suit === game.trumpSuit ? 1 : 0) - (b.suit === game.trumpSuit ? 1 : 0) || a.rank - b.rank
  );
  const chosen = candidates[0];
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

  if (canAdd && Math.random() < 0.75) {
    candidates.sort((a, b) => a.rank - b.rank);
    const card = candidates[0];
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
  const nonTrump = game.bot.filter((c) => c.suit !== game.trumpSuit);
  const pool = nonTrump.length ? nonTrump : game.bot;
  const sorted = [...pool].sort((a, b) => a.rank - b.rank);
  const card = sorted[0];
  game.bot.splice(game.bot.indexOf(card), 1);
  game.table.push({ attack: card, defend: null });
  game.busy = false;
  setStatus(`Бот пошёл с ${cardText(card)}. Отбейтесь или возьмите карты.`);
  render();
}

function botTakesAll() {
  game.bot.push(...game.table.flatMap((p) => [p.attack, p.defend].filter(Boolean)));
  game.table = [];
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
    endGame("Ничья! Карты закончились одновременно.");
    return true;
  }
  if (game.player.length === 0) {
    endGame("Вы победили! Бот остался Дураком. 🎉");
    return true;
  }
  if (game.bot.length === 0) {
    endGame("Бот победил. Вы — Дурак 🃏");
    return true;
  }
  return false;
}

function endGame(text) {
  game.over = true;
  setStatus(text);
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

els.takeBtn.addEventListener("click", () => {
  if (game.busy || game.over) return;
  game.player.push(...game.table.flatMap((p) => [p.attack, p.defend].filter(Boolean)));
  game.table = [];
  sortHand(game.player);
  setStatus("Вы забрали карты.");
  game.busy = true;
  render();
  drawPhase(["bot"]);
  if (finishIfGameOver()) return;
  game.busy = false;
  startAttackTurn();
});

els.bitoBtn.addEventListener("click", () => {
  if (game.busy || game.over) return;
  game.busy = true;
  finishRoundBito();
});

els.newGameBtn.addEventListener("click", () => {
  initGame();
});

initGame();
