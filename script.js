const SYMBOLS = [
  { icon: "🍒", mult: 2 },
  { icon: "🍋", mult: 3 },
  { icon: "🍇", mult: 4 },
  { icon: "⭐", mult: 6 },
  { icon: "💎", mult: 10 },
  { icon: "7️⃣", mult: 20 },
];

const BALANCE_KEY = "amsBalance";
const DURAK_UNLOCK = 500000;

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
  ],
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
  durakNavItem: document.getElementById("durakNavItem"),
  durakLockIcon: document.getElementById("durakLockIcon"),
  lockToast: document.getElementById("lockToast"),
};

function formatNumber(n) {
  return n.toLocaleString("ru-RU");
}

function renderBalance() {
  els.balance.textContent = formatNumber(state.balance);
  localStorage.setItem(BALANCE_KEY, state.balance);
  updateDurakLock();
}

let toastTimer = null;
function showToast(text) {
  els.lockToast.textContent = text;
  els.lockToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.lockToast.classList.remove("show"), 2600);
}

function updateDurakLock() {
  const unlocked = state.balance >= DURAK_UNLOCK;
  els.durakNavItem.classList.toggle("locked", !unlocked);
  els.durakLockIcon.textContent = unlocked ? "" : "🔒";
}

els.durakNavItem.addEventListener("click", (e) => {
  if (state.balance < DURAK_UNLOCK) {
    e.preventDefault();
    showToast(
      `Наберите ${formatNumber(DURAK_UNLOCK)} ₽, чтобы открыть Дурак Онлайн (сейчас ${formatNumber(state.balance)} ₽)`
    );
  }
});

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

  showWithdrawCard(winnings);
}

els.spinBtn.addEventListener("click", spin);

function showWithdrawCard(amount) {
  els.withdrawAmount.textContent = formatNumber(amount);
  els.withdrawCard.dataset.amount = amount;
  els.withdrawError.textContent = "";
  els.cardNumber.value = "";
  els.phoneNumber.value = "";
  els.cardBrand.className = "card-brand";
  els.withdrawBtn.disabled = false;
  els.withdrawBtn.textContent = "Вывести";
  els.withdrawSuccess.classList.add("hidden");
  els.withdrawForm.classList.remove("hidden");
  els.withdrawCard.classList.remove("hidden");
}

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

  setTimeout(() => {
    const amount = Number(els.withdrawCard.dataset.amount || 0);
    els.successAmount.textContent = `${formatNumber(amount)} ₽`;
    els.successId.textContent = randomTxId();
    els.successTime.textContent = new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    els.withdrawForm.classList.add("hidden");
    els.withdrawSuccess.classList.remove("hidden");
    state.withdrawing = false;
  }, 1300);
});

els.withdrawDone.addEventListener("click", () => {
  els.withdrawCard.classList.add("hidden");
});

renderBalance();
renderBet();
[0, 1, 2].forEach((i) => setReelSymbol(i, SYMBOLS[i].icon));
