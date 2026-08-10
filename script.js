const SYMBOLS = [
  { icon: "🍒", weight: 35, pay: { 3: 1, 4: 3, 5: 8 } },
  { icon: "🍋", weight: 25, pay: { 3: 2, 4: 5, 5: 12 } },
  { icon: "🍇", weight: 18, pay: { 3: 3, 4: 8, 5: 20 } },
  { icon: "⭐", weight: 12, pay: { 3: 5, 4: 15, 5: 40 } },
  { icon: "💎", weight: 7, pay: { 3: 10, 4: 30, 5: 80 } },
  { icon: "7️⃣", weight: 3, pay: { 3: 20, 4: 60, 5: 150 } },
];

const REEL_COUNT = 5;

const BALANCE_KEY = "amsBalance";

const state = {
  balance: Number(localStorage.getItem(BALANCE_KEY)) || 1000,
  bet: 50,
  spinning: false,
  method: "card",
  withdrawing: false,
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
    document.getElementById("strip3"),
    document.getElementById("strip4"),
  ],
  paytableRows: document.getElementById("paytableRows"),
  paytableBet: document.getElementById("paytableBet"),
  withdrawCard: document.getElementById("withdrawCard"),
  withdrawForm: document.getElementById("withdrawForm"),
  withdrawSuccess: document.getElementById("withdrawSuccess"),
  withdrawAmount: document.getElementById("withdrawAmount"),
  methodTabs: document.querySelectorAll("#withdrawForm .method-tab"),
  panelCard: document.getElementById("panelCard"),
  panelSbp: document.getElementById("panelSbp"),
  cardNumber: document.getElementById("cardNumber"),
  cardBrand: document.getElementById("cardBrand"),
  phoneNumber: document.getElementById("phoneNumber"),
  withdrawError: document.getElementById("withdrawError"),
  withdrawBtn: document.getElementById("withdrawBtn"),
  withdrawDone: document.getElementById("withdrawDone"),
  successAmount: document.getElementById("successAmount"),
  successId: document.getElementById("successId"),
  successTime: document.getElementById("successTime"),
};

function formatNumber(n) {
  return n.toLocaleString("ru-RU");
}

function renderBalance() {
  els.balance.textContent = formatNumber(state.balance);
  localStorage.setItem(BALANCE_KEY, state.balance);
  syncWithdrawAmount();
}

function syncWithdrawAmount() {
  els.withdrawAmount.textContent = formatNumber(state.balance);
  els.withdrawCard.dataset.amount = state.balance;
}

function renderBet() {
  els.bet.textContent = formatNumber(state.bet);
  els.paytableBet.textContent = formatNumber(state.bet);
  renderPaytable();
}

function renderPaytable() {
  els.paytableRows.innerHTML = "";
  SYMBOLS.forEach((sym) => {
    const row = document.createElement("div");
    row.className = "paytable-row";
    row.innerHTML = `
      <span class="paytable-symbol">${sym.icon}</span>
      <span class="paytable-values">
        <span>×3<b>${formatNumber(sym.pay[3] * state.bet)}</b></span>
        <span>×4<b>${formatNumber(sym.pay[4] * state.bet)}</b></span>
        <span>×5<b>${formatNumber(sym.pay[5] * state.bet)}</b></span>
      </span>
    `;
    els.paytableRows.appendChild(row);
  });
}

function weightedRandomSymbol() {
  const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    if (r < sym.weight) return sym;
    r -= sym.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
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
        setReelSymbol(index, weightedRandomSymbol().icon);
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
  if (state.spinning || state.withdrawing) return;
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

  const outcome = els.reels.map(() => weightedRandomSymbol());

  await Promise.all(
    els.reels.map((_, i) => spinReel(i, i * 130, 650 + i * 150))
  );

  outcome.forEach((sym, i) => setReelSymbol(i, sym.icon));

  let matchCount = 1;
  while (matchCount < outcome.length && outcome[matchCount].icon === outcome[0].icon) {
    matchCount++;
  }

  if (matchCount >= 3) {
    const winnings = state.bet * outcome[0].pay[matchCount];
    state.balance += winnings;
    renderBalance();
    els.message.textContent = `${outcome[0].icon} × ${matchCount} — ВЫИГРЫШ ${formatNumber(winnings)} ₽!`;
    els.message.classList.add("win");
  } else {
    els.message.textContent = "Комбинации нет. Попробуйте ещё раз.";
    els.message.classList.remove("win");
  }

  state.spinning = false;
  els.spinBtn.disabled = false;
  els.betMinus.disabled = false;
  els.betPlus.disabled = false;
}

els.spinBtn.addEventListener("click", spin);

els.methodTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.method = tab.dataset.method;
    els.methodTabs.forEach((t) => t.classList.toggle("active", t === tab));
    els.panelCard.classList.toggle("hidden", state.method !== "card");
    els.panelSbp.classList.toggle("hidden", state.method !== "sbp");
    els.withdrawError.textContent = "";
  });
});

function detectBrand(digits) {
  if (digits.startsWith("4")) return "visa";
  if (digits.startsWith("5")) return "mastercard";
  if (digits.startsWith("2")) return "mir";
  return "";
}

els.cardNumber.addEventListener("input", () => {
  const digits = els.cardNumber.value.replace(/\D/g, "").slice(0, 16);
  els.cardNumber.value = digits.replace(/(.{4})/g, "$1 ").trim();
  const brand = detectBrand(digits);
  els.cardBrand.className = brand ? `card-brand ${brand}` : "card-brand";
  els.cardBrand.textContent = brand ? brand.toUpperCase() : "";
});

els.phoneNumber.addEventListener("input", () => {
  let digits = els.phoneNumber.value.replace(/\D/g, "").slice(0, 11);
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  const rest = digits.slice(1);
  let formatted = "+7";
  if (rest.length) formatted += " " + rest.slice(0, 3);
  if (rest.length > 3) formatted += " " + rest.slice(3, 6);
  if (rest.length > 6) formatted += "-" + rest.slice(6, 8);
  if (rest.length > 8) formatted += "-" + rest.slice(8, 10);
  els.phoneNumber.value = formatted;
});

function randomTxId() {
  return "AMS-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

els.withdrawBtn.addEventListener("click", () => {
  if (state.withdrawing) return;
  if (state.balance <= 0) {
    els.withdrawError.textContent = "Баланс пуст — выводить нечего.";
    return;
  }

  if (state.method === "card") {
    const digits = els.cardNumber.value.replace(/\D/g, "");
    if (digits.length !== 16) {
      els.withdrawError.textContent = "Введите номер карты полностью.";
      return;
    }
  } else {
    const digits = els.phoneNumber.value.replace(/\D/g, "");
    if (digits.length !== 11) {
      els.withdrawError.textContent = "Введите номер телефона полностью.";
      return;
    }
  }

  els.withdrawError.textContent = "";
  state.withdrawing = true;
  els.withdrawBtn.disabled = true;
  els.withdrawBtn.textContent = "Обработка...";
  els.spinBtn.disabled = true;

  const amount = Number(els.withdrawCard.dataset.amount || 0);

  setTimeout(() => {
    state.balance -= amount;
    state.bet = Math.min(state.bet, Math.max(10, state.balance));
    renderBalance();
    renderBet();

    els.successAmount.textContent = `${formatNumber(amount)} ₽`;
    els.successId.textContent = randomTxId();
    els.successTime.textContent = new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    els.withdrawForm.classList.add("hidden");
    els.withdrawSuccess.classList.remove("hidden");
    state.withdrawing = false;
    els.spinBtn.disabled = false;
  }, 1300);
});

els.withdrawDone.addEventListener("click", () => {
  els.withdrawError.textContent = "";
  els.cardNumber.value = "";
  els.phoneNumber.value = "";
  els.cardBrand.className = "card-brand";
  els.withdrawBtn.disabled = false;
  els.withdrawBtn.textContent = "Вывести";
  els.withdrawSuccess.classList.add("hidden");
  els.withdrawForm.classList.remove("hidden");
});

renderBalance();
renderBet();
els.reels.forEach((_, i) => setReelSymbol(i, SYMBOLS[i % SYMBOLS.length].icon));
