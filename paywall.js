const paywall = {
  overlay: document.getElementById("paywallOverlay"),
  form: document.getElementById("paywallForm"),
  payment: document.getElementById("paywallPayment"),
  success: document.getElementById("paywallSuccess"),
  feature: document.getElementById("paywallFeature"),
  payBtn: document.getElementById("paywallPayBtn"),
  confirmBtn: document.getElementById("paywallConfirmBtn"),
  backBtn: document.getElementById("paywallBackBtn"),
  closeBtn: document.getElementById("paywallClose"),
  doneBtn: document.getElementById("paywallDone"),
  methodTabs: document.querySelectorAll("#paywallPayment .method-tab"),
  panelCard: document.getElementById("paywallPanelCard"),
  panelSbp: document.getElementById("paywallPanelSbp"),
  cardNumber: document.getElementById("paywallCardNumber"),
  cardBrand: document.getElementById("paywallCardBrand"),
  phoneNumber: document.getElementById("paywallPhoneNumber"),
  payError: document.getElementById("paywallPayError"),
};

let paywallMethod = "card";

function openPaywall(featureName) {
  paywall.feature.textContent = featureName;
  showStep("plan");
  paywall.overlay.classList.remove("hidden");
}

function showStep(step) {
  paywall.form.classList.toggle("hidden", step !== "plan");
  paywall.payment.classList.toggle("hidden", step !== "payment");
  paywall.success.classList.toggle("hidden", step !== "success");

  if (step === "payment") {
    paywallMethod = "card";
    paywall.methodTabs.forEach((t) => t.classList.toggle("active", t.dataset.method === "card"));
    paywall.panelCard.classList.remove("hidden");
    paywall.panelSbp.classList.add("hidden");
    paywall.cardNumber.value = "";
    paywall.phoneNumber.value = "";
    paywall.cardBrand.className = "card-brand";
    paywall.payError.textContent = "";
    paywall.confirmBtn.disabled = false;
    paywall.confirmBtn.textContent = "Оплатить 2 990 ₽";
  }
}

function closePaywall() {
  paywall.overlay.classList.add("hidden");
}

document.querySelectorAll(".locked-feature").forEach((el) => {
  el.addEventListener("click", () => openPaywall(el.dataset.feature || "Модуль"));
});

paywall.closeBtn.addEventListener("click", closePaywall);

paywall.overlay.addEventListener("click", (e) => {
  if (e.target === paywall.overlay) closePaywall();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !paywall.overlay.classList.contains("hidden")) closePaywall();
});

paywall.payBtn.addEventListener("click", () => {
  showStep("payment");
});

paywall.backBtn.addEventListener("click", () => {
  showStep("plan");
});

paywall.methodTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    paywallMethod = tab.dataset.method;
    paywall.methodTabs.forEach((t) => t.classList.toggle("active", t === tab));
    paywall.panelCard.classList.toggle("hidden", paywallMethod !== "card");
    paywall.panelSbp.classList.toggle("hidden", paywallMethod !== "sbp");
    paywall.payError.textContent = "";
  });
});

function paywallDetectBrand(digits) {
  if (digits.startsWith("4")) return "visa";
  if (digits.startsWith("5")) return "mastercard";
  if (digits.startsWith("2")) return "mir";
  return "";
}

paywall.cardNumber.addEventListener("input", () => {
  const digits = paywall.cardNumber.value.replace(/\D/g, "").slice(0, 16);
  paywall.cardNumber.value = digits.replace(/(.{4})/g, "$1 ").trim();
  const brand = paywallDetectBrand(digits);
  paywall.cardBrand.className = brand ? `card-brand ${brand}` : "card-brand";
  paywall.cardBrand.textContent = brand ? brand.toUpperCase() : "";
});

paywall.phoneNumber.addEventListener("input", () => {
  let digits = paywall.phoneNumber.value.replace(/\D/g, "").slice(0, 11);
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  const rest = digits.slice(1);
  let formatted = "+7";
  if (rest.length) formatted += " " + rest.slice(0, 3);
  if (rest.length > 3) formatted += " " + rest.slice(3, 6);
  if (rest.length > 6) formatted += "-" + rest.slice(6, 8);
  if (rest.length > 8) formatted += "-" + rest.slice(8, 10);
  paywall.phoneNumber.value = formatted;
});

paywall.confirmBtn.addEventListener("click", () => {
  if (paywallMethod === "card") {
    const digits = paywall.cardNumber.value.replace(/\D/g, "");
    if (digits.length !== 16) {
      paywall.payError.textContent = "Введите номер карты полностью.";
      return;
    }
  } else {
    const digits = paywall.phoneNumber.value.replace(/\D/g, "");
    if (digits.length !== 11) {
      paywall.payError.textContent = "Введите номер телефона полностью.";
      return;
    }
  }

  paywall.payError.textContent = "";
  paywall.confirmBtn.disabled = true;
  paywall.confirmBtn.textContent = "Обработка платежа...";

  setTimeout(() => {
    showStep("success");
  }, 1300);
});

paywall.doneBtn.addEventListener("click", closePaywall);
