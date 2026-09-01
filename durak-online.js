// Онлайн-режим «Дурак с другом»: два человека играют друг с другом через
// Firebase Realtime Database вместо бота. Хост (создатель комнаты) держит
// авторитетное состояние партии в своём браузере и рассылает его гостю;
// гость отправляет свои ходы хосту через очередь действий и просто
// отображает то, что приходит в ответ. Карточные хелперы (cardText,
// cardBeats, makeCardEl, createDeck, sortHand и т.д.) переиспользуются из
// durak.js, который подключается на странице раньше этого файла.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function otherSide(side) {
  return side === "host" ? "guest" : "host";
}

function handHasCard(hand, card) {
  return hand.some((c) => c.suit === card.suit && c.rank === card.rank);
}

function takeCardFromHand(hand, card) {
  const idx = hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
  if (idx !== -1) hand.splice(idx, 1);
}

function allDefendedView(v) {
  return v.table.length > 0 && v.table.every((p) => p.defend);
}

const onEls = {
  modeTabs: document.querySelectorAll("#gameModeTabs .method-tab"),
  botWrap: document.getElementById("botModeWrap"),
  onlineWrap: document.getElementById("onlineModeWrap"),

  lobby: document.getElementById("onlineLobby"),
  room: document.getElementById("onlineRoom"),
  configWarning: document.getElementById("onlineConfigWarning"),
  lobbyError: document.getElementById("onlineLobbyError"),
  createBtn: document.getElementById("onlineCreateBtn"),
  joinCode: document.getElementById("onlineJoinCode"),
  joinBtn: document.getElementById("onlineJoinBtn"),

  roomCode: document.getElementById("onlineRoomCode"),
  copyBtn: document.getElementById("onlineCopyBtn"),
  leaveBtn: document.getElementById("onlineLeaveBtn"),

  trumpDisplay: document.getElementById("onTrumpDisplay"),
  deckCount: document.getElementById("onDeckCount"),
  oppCount: document.getElementById("onOppCount"),
  status: document.getElementById("onlineStatus"),
  oppHand: document.getElementById("onOppHand"),
  table: document.getElementById("onlineTable"),
  myHand: document.getElementById("onMyHand"),
  takeBtn: document.getElementById("onTakeBtn"),
  bitoBtn: document.getElementById("onBitoBtn"),
  giveBtn: document.getElementById("onGiveBtn"),
};

let on = null; // active online session, or null when in the lobby
let firebaseDb = null;
let firebaseInitTried = false;

function isFirebaseConfigured() {
  const cfg = window.FIREBASE_CONFIG;
  return !!(cfg && cfg.apiKey && cfg.apiKey !== "YOUR_API_KEY" && cfg.databaseURL);
}

function getDb() {
  if (firebaseDb) return firebaseDb;
  if (!isFirebaseConfigured()) return null;
  if (!firebaseInitTried) {
    firebaseInitTried = true;
    try {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      firebaseDb = firebase.database();
    } catch (e) {
      console.error("Не удалось инициализировать Firebase:", e);
      firebaseDb = null;
    }
  }
  return firebaseDb;
}

function refreshOnlineAvailability() {
  const ready = isFirebaseConfigured();
  onEls.createBtn.disabled = !ready;
  onEls.joinBtn.disabled = !ready;
  onEls.configWarning.classList.toggle("hidden", ready);
}

function setOnlineStatus(text) {
  const prefix = on && on.opponentOffline ? "⚠️ Соперник отключился, ждём переподключения. " : "";
  onEls.status.textContent = prefix + text;
}

function showOnlineLobbyUI() {
  onEls.lobby.classList.remove("hidden");
  onEls.room.classList.add("hidden");
  onEls.lobbyError.textContent = "";
  onEls.joinCode.value = "";
}

function showOnlineRoomUI(code) {
  onEls.roomCode.textContent = code;
  onEls.lobby.classList.add("hidden");
  onEls.room.classList.remove("hidden");
}

// ---------- host: authoritative game engine ----------

function hostDealAndStart() {
  const deck = createDeck();
  const trumpCard = deck[deck.length - 1];
  const hands = { host: [], guest: [] };
  for (let i = 0; i < 6; i++) {
    hands.host.push(deck.shift());
    hands.guest.push(deck.shift());
  }
  sortHand(hands.host);
  sortHand(hands.guest);

  on.hostGame = {
    deck,
    trumpCard,
    trumpSuit: trumpCard.suit,
    hands,
    table: [],
    attacker: Math.random() < 0.5 ? "host" : "guest",
    takingSide: null,
    over: false,
    winner: null,
  };
  hostPushState();
}

function hostAllDefended(g) {
  return g.table.length > 0 && g.table.every((p) => p.defend);
}

function hostDrawPhase(sides) {
  const g = on.hostGame;
  sides.forEach((side) => {
    while (g.hands[side].length < 6 && g.deck.length > 0) {
      g.hands[side].push(g.deck.shift());
    }
    sortHand(g.hands[side]);
  });
}

function hostCheckGameOver() {
  const g = on.hostGame;
  if (g.deck.length > 0) return false;
  if (g.hands.host.length === 0 && g.hands.guest.length === 0) {
    g.over = true;
    g.winner = "draw";
    return true;
  }
  if (g.hands.host.length === 0) {
    g.over = true;
    g.winner = "host";
    return true;
  }
  if (g.hands.guest.length === 0) {
    g.over = true;
    g.winner = "guest";
    return true;
  }
  return false;
}

function hostApplyAction(side, type, card) {
  const g = on.hostGame;
  if (!g || g.over) return;
  const attackerSide = g.attacker;
  const defenderSide = otherSide(attackerSide);

  if (type === "attack") {
    if (side !== attackerSide) return;
    if (!card || !handHasCard(g.hands[side], card)) return;
    const empty = g.table.length === 0;
    if (!empty && g.takingSide === null && !hostAllDefended(g)) return;
    if (g.table.length >= 6) return;
    if (!empty) {
      const ranksOnTable = new Set(
        g.table.flatMap((p) => [p.attack.rank, p.defend ? p.defend.rank : null]).filter((r) => r !== null)
      );
      if (!ranksOnTable.has(card.rank)) return;
    }
    if (g.takingSide === null && !empty && g.hands[defenderSide].length === 0) return;
    takeCardFromHand(g.hands[side], card);
    g.table.push({ attack: card, defend: null });
  } else if (type === "defend") {
    if (side !== defenderSide || g.takingSide !== null) return;
    const idx = g.table.findIndex((p) => !p.defend);
    if (idx === -1 || !card || !handHasCard(g.hands[side], card)) return;
    if (!cardBeats(card, g.table[idx].attack, g.trumpSuit)) return;
    takeCardFromHand(g.hands[side], card);
    g.table[idx].defend = card;
  } else if (type === "take") {
    if (side !== defenderSide || g.takingSide !== null) return;
    if (!g.table.some((p) => !p.defend)) return;
    g.takingSide = side;
  } else if (type === "give") {
    if (side !== attackerSide || g.takingSide !== defenderSide) return;
    g.hands[defenderSide].push(...g.table.flatMap((p) => [p.attack, p.defend].filter(Boolean)));
    g.table = [];
    g.takingSide = null;
    hostDrawPhase([attackerSide]);
    hostCheckGameOver();
  } else if (type === "bito") {
    if (side !== attackerSide || g.takingSide !== null || !hostAllDefended(g)) return;
    const prevAttacker = attackerSide;
    g.table = [];
    g.attacker = defenderSide;
    hostDrawPhase([prevAttacker, defenderSide]);
    hostCheckGameOver();
  } else {
    return;
  }
  hostPushState();
}

function hostPushState() {
  const g = on.hostGame;
  const state = {
    trumpCard: g.trumpCard,
    trumpSuit: g.trumpSuit,
    deckCount: g.deck.length,
    table: g.table,
    attacker: g.attacker,
    takingSide: g.takingSide,
    counts: { host: g.hands.host.length, guest: g.hands.guest.length },
    over: g.over,
    winner: g.winner || null,
    status: "playing",
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  };
  on.roomRef.update({
    state,
    "hands/host": g.hands.host,
    "hands/guest": g.hands.guest,
  });

  on.view = {
    trumpCard: g.trumpCard,
    trumpSuit: g.trumpSuit,
    deckCount: g.deck.length,
    table: g.table,
    attacker: g.attacker,
    takingSide: g.takingSide,
    counts: { host: g.hands.host.length, guest: g.hands.guest.length },
    over: g.over,
    winner: g.winner || null,
    myHand: g.hands[on.myKey],
  };
  renderOnline();
}

// ---------- shared: sending my own moves (host applies locally, guest queues) ----------

function requestAction(type, card) {
  if (!on || on.busy) return;
  if (on.view && on.view.over) return;
  if (on.role === "host") {
    hostApplyAction("host", type, card || null);
  } else {
    on.busy = true;
    on.roomRef.child("actions").push({
      by: "guest",
      type,
      card: card || null,
      ts: firebase.database.ServerValue.TIMESTAMP,
    });
    renderOnline();
  }
}

function onlineHandleMyCardClick(card) {
  const v = on.view;
  if (!v || v.over || on.busy) return;
  const isAttacker = v.attacker === on.myKey;

  if (isAttacker) {
    if (v.table.length === 0) {
      requestAction("attack", card);
      return;
    }
    if (v.takingSide === on.oppKey) {
      if (v.table.length >= 6) {
        setOnlineStatus("На столе уже максимум карт для этого раунда.");
        return;
      }
      const ranksOnTable = new Set(
        v.table.flatMap((p) => [p.attack.rank, p.defend ? p.defend.rank : null]).filter((r) => r !== null)
      );
      if (!ranksOnTable.has(card.rank)) {
        setOnlineStatus("Можно подкинуть только карту такого же достоинства, как на столе.");
        return;
      }
      requestAction("attack", card);
      return;
    }
    if (!allDefendedView(v)) {
      setOnlineStatus("Дождитесь ответа соперника.");
      return;
    }
    if (v.table.length >= 6) {
      setOnlineStatus("На столе уже максимум карт для этого раунда.");
      return;
    }
    if (v.counts[on.oppKey] === 0) {
      setOnlineStatus("У соперника не осталось карт — нажмите «Бито».");
      return;
    }
    const ranksOnTable = new Set(v.table.flatMap((p) => [p.attack.rank, p.defend.rank]));
    if (!ranksOnTable.has(card.rank)) {
      setOnlineStatus("Можно подкинуть только карту такого же достоинства, как на столе.");
      return;
    }
    requestAction("attack", card);
  } else {
    if (v.takingSide !== null) {
      setOnlineStatus("Вы забираете карты — дождитесь соперника.");
      return;
    }
    const idx = v.table.findIndex((p) => !p.defend);
    if (idx === -1) return;
    const atk = v.table[idx].attack;
    if (!cardBeats(card, atk, v.trumpSuit)) {
      setOnlineStatus(`Эта карта не бьёт ${cardText(atk)}.`);
      return;
    }
    requestAction("defend", card);
  }
}

// ---------- rendering ----------

function renderOnline() {
  if (!on || !on.view) return;
  const v = on.view;

  onEls.trumpDisplay.textContent = cardText(v.trumpCard);
  onEls.trumpDisplay.className = `meta-value ${isRed(v.trumpCard.suit) ? "red-text" : "black-text"}`;
  onEls.deckCount.textContent = v.deckCount;
  onEls.oppCount.textContent = v.counts[on.oppKey];

  onEls.oppHand.innerHTML = "";
  for (let i = 0; i < v.counts[on.oppKey]; i++) {
    onEls.oppHand.appendChild(makeCardEl(null, { faceDown: true }));
  }

  onEls.table.innerHTML = "";
  if (v.table.length === 0) {
    const hint = document.createElement("div");
    hint.className = "table-empty-hint";
    hint.textContent = "Стол пуст";
    onEls.table.appendChild(hint);
  } else {
    v.table.forEach((pair) => {
      const wrap = document.createElement("div");
      wrap.className = "table-pair";
      wrap.appendChild(makeCardEl(pair.attack));
      if (pair.defend) wrap.appendChild(makeCardEl(pair.defend, { extraClass: "defend-card" }));
      onEls.table.appendChild(wrap);
    });
  }

  onEls.myHand.innerHTML = "";
  (v.myHand || []).forEach((card) => {
    const canClick = !v.over && !on.busy;
    const el = makeCardEl(card, { clickable: canClick });
    el.addEventListener("click", () => onlineHandleMyCardClick(card));
    onEls.myHand.appendChild(el);
  });

  const isAttacker = v.attacker === on.myKey;
  const canBito = !v.over && isAttacker && v.takingSide === null && allDefendedView(v);
  const canTake = !v.over && !isAttacker && v.takingSide === null && v.table.some((p) => !p.defend);
  const canGive = !v.over && isAttacker && v.takingSide === on.oppKey;
  onEls.takeBtn.classList.toggle("hidden", !canTake);
  onEls.bitoBtn.classList.toggle("hidden", !canBito);
  onEls.giveBtn.classList.toggle("hidden", !canGive);

  if (v.over) {
    if (v.winner === "draw") setOnlineStatus("Ничья! Карты закончились одновременно.");
    else if (v.winner === on.myKey) setOnlineStatus("Вы победили! Соперник остался Дураком. 🎉");
    else setOnlineStatus("Вы — Дурак 🃏");
  } else if (isAttacker) {
    if (v.takingSide) setOnlineStatus("Соперник берёт карты. Подкиньте ещё или нажмите «Отдать карты».");
    else if (v.table.length === 0) setOnlineStatus("Ваш ход — выберите карту для атаки.");
    else setOnlineStatus("Подкиньте карту той же масти или нажмите «Бито».");
  } else {
    if (v.takingSide === on.myKey) setOnlineStatus("Вы забираете карты со стола.");
    else setOnlineStatus("Отбейтесь или нажмите «Взять карты».");
  }
}

// ---------- room lifecycle ----------

async function createOnlineRoom() {
  const db = getDb();
  if (!db) return;
  onEls.lobbyError.textContent = "";

  let code = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generateRoomCode();
    const snap = await db.ref(`rooms/${candidate}`).get();
    if (!snap.exists()) code = candidate;
  }
  if (!code) {
    onEls.lobbyError.textContent = "Не удалось создать комнату, попробуйте ещё раз.";
    return;
  }

  const roomRef = db.ref(`rooms/${code}`);
  on = {
    role: "host",
    roomId: code,
    roomRef,
    myKey: "host",
    oppKey: "guest",
    view: null,
    busy: false,
    hostGame: null,
    opponentOffline: false,
  };

  await roomRef.set({
    status: "waiting",
    hostConnected: true,
    guestConnected: false,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });
  roomRef.child("hostConnected").onDisconnect().set(false);

  roomRef.child("actions").on("child_added", (snap) => {
    const action = snap.val();
    if (action && action.by === "guest") hostApplyAction("guest", action.type, action.card);
    snap.ref.remove();
  });

  roomRef.child("guestConnected").on("value", (snap) => {
    const connected = snap.val() === true;
    if (connected && !on.hostGame) {
      hostDealAndStart();
      roomRef.update({ status: "playing" });
    }
    on.opponentOffline = !!on.hostGame && !connected;
    if (on.view) renderOnline();
  });

  showOnlineRoomUI(code);
  setOnlineStatus("Комната создана. Ждём соперника...");
}

async function joinOnlineRoom(rawCode) {
  const db = getDb();
  if (!db) return;
  const code = rawCode.trim().toUpperCase();
  onEls.lobbyError.textContent = "";
  if (!code) {
    onEls.lobbyError.textContent = "Введите код комнаты.";
    return;
  }

  const roomRef = db.ref(`rooms/${code}`);
  const snap = await roomRef.get();
  if (!snap.exists()) {
    onEls.lobbyError.textContent = "Комната не найдена.";
    return;
  }
  const data = snap.val();
  if (data.guestConnected) {
    onEls.lobbyError.textContent = "В этой комнате уже есть второй игрок.";
    return;
  }

  on = {
    role: "guest",
    roomId: code,
    roomRef,
    myKey: "guest",
    oppKey: "host",
    view: null,
    busy: false,
    opponentOffline: false,
    stateReceived: false,
    handReceived: false,
  };

  await roomRef.update({ guestConnected: true });
  roomRef.child("guestConnected").onDisconnect().set(false);

  roomRef.child("hostConnected").on("value", (snap) => {
    on.opponentOffline = snap.val() === false;
    if (on.view) renderOnline();
  });

  roomRef.child("state").on("value", (snap) => {
    const state = snap.val();
    if (!state) return;
    on.busy = false;
    on.view = Object.assign({}, on.view, state);
    on.stateReceived = true;
    if (on.stateReceived && on.handReceived) renderOnline();
  });

  roomRef.child("hands/guest").on("value", (snap) => {
    on.view = Object.assign({}, on.view, { myHand: snap.val() || [] });
    on.handReceived = true;
    if (on.stateReceived && on.handReceived) renderOnline();
  });

  showOnlineRoomUI(code);
  setOnlineStatus("Подключено. Ждём начала раздачи...");
}

function leaveOnlineRoom() {
  if (!on) return;
  const { roomRef, role } = on;
  roomRef.off();
  roomRef.child("actions").off();
  if (role === "host") {
    roomRef.update({ status: "closed", hostConnected: false }).catch(() => {});
  } else {
    roomRef.update({ guestConnected: false }).catch(() => {});
  }
  on = null;
  showOnlineLobbyUI();
}

// ---------- wiring ----------

onEls.modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    onEls.modeTabs.forEach((t) => t.classList.toggle("active", t === tab));
    const mode = tab.dataset.mode;
    onEls.botWrap.classList.toggle("hidden", mode !== "bot");
    onEls.onlineWrap.classList.toggle("hidden", mode !== "online");
    if (mode === "online") refreshOnlineAvailability();
  });
});

onEls.createBtn.addEventListener("click", () => {
  createOnlineRoom();
});

onEls.joinBtn.addEventListener("click", () => {
  joinOnlineRoom(onEls.joinCode.value);
});

onEls.joinCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinOnlineRoom(onEls.joinCode.value);
});

onEls.copyBtn.addEventListener("click", () => {
  if (!on) return;
  navigator.clipboard
    .writeText(on.roomId)
    .then(() => {
      onEls.copyBtn.textContent = "Скопировано!";
      setTimeout(() => (onEls.copyBtn.textContent = "Скопировать"), 1500);
    })
    .catch(() => {});
});

onEls.leaveBtn.addEventListener("click", () => {
  leaveOnlineRoom();
});

onEls.takeBtn.addEventListener("click", () => requestAction("take"));
onEls.bitoBtn.addEventListener("click", () => requestAction("bito"));
onEls.giveBtn.addEventListener("click", () => requestAction("give"));

refreshOnlineAvailability();
