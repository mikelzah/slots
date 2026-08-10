const SYMBOLS = [
  { icon: "🍒", mult: 2 },
  { icon: "🍋", mult: 3 },
  { icon: "🍇", mult: 4 },
  { icon: "⭐", mult: 6 },
  { icon: "💎", mult: 10 },
  { icon: "7️⃣", mult: 20 },
];

const state = {
  balance: 1000,
  bet: 50,
  spinning: false,
};

const els = {
  balance: document.getElementById("balance"),
  bet: document.getElementById("bet"),
  betMinus: document.getElementById("betMinus"),
  betPlus: document.getElementById("betPlus"),
  spinBtn: document.getElementById("spinBtn"),
  message: document.getElementById("message"),
  reels: [
    document.getElementById("strip0"),
    document.getElementById("strip1"),
    document.getElementById("strip2"),
  ],
};

function formatNumber(n) {
  return n.toLocaleString("ru-RU");
}

function renderBalance() {
  els.balance.textContent = formatNumber(state.balance);
}

function renderBet() {
  els.bet.textContent = formatNumber(state.bet);
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

els.betMinus.addEventListener("click", () => {
  if (state.spinning) return;
  state.bet = Math.max(10, state.bet - 10);
  renderBet();
});

els.betPlus.addEventListener("click", () => {
  if (state.spinning) return;
  state.bet = Math.min(state.balance, state.bet + 10);
  renderBet();
});

function setReelSymbol(index, icon) {
  els.reels[index].textContent = icon;
}

function spinReel(index, delay, duration) {
  return new Promise((resolve) => {
    const reelEl = els.reels[index].parentElement;
    setTimeout(() => {
      reelEl.classList.add("spinning");
      const cycle = setInterval(() => {
        setReelSymbol(index, randomSymbol().icon);
      }, 60);

      setTimeout(() => {
        clearInterval(cycle);
        reelEl.classList.remove("spinning");
        resolve();
      }, duration);
    }, delay);
  });
}

async function spin() {
  if (state.spinning) return;
  if (state.bet > state.balance) {
    els.message.textContent = "Недостаточно средств для этой ставки.";
    els.message.classList.remove("win");
    return;
  }

  state.spinning = true;
  els.spinBtn.disabled = true;
  els.betMinus.disabled = true;
  els.betPlus.disabled = true;
  els.message.classList.remove("win");
  els.message.textContent = "Крутим барабаны...";

  state.balance -= state.bet;
  renderBalance();

  const winSymbol = randomSymbol();

  await Promise.all([
    spinReel(0, 0, 700),
    spinReel(1, 150, 850),
    spinReel(2, 300, 1000),
  ]);

  setReelSymbol(0, winSymbol.icon);
  setReelSymbol(1, winSymbol.icon);
  setReelSymbol(2, winSymbol.icon);

  const winnings = state.bet * winSymbol.mult;
  state.balance += winnings;
  renderBalance();

  els.message.textContent = `ПОЗДРАВЛЯЕМ! ВЫ ВЫИГРАЛИ ${formatNumber(winnings)} !`;
  els.message.classList.add("win");

  state.spinning = false;
  els.spinBtn.disabled = false;
  els.betMinus.disabled = false;
  els.betPlus.disabled = false;
}

els.spinBtn.addEventListener("click", spin);

renderBalance();
renderBet();
[0, 1, 2].forEach((i) => setReelSymbol(i, SYMBOLS[i].icon));
