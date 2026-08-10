const paywall = {
  overlay: document.getElementById("paywallOverlay"),
  form: document.getElementById("paywallForm"),
  success: document.getElementById("paywallSuccess"),
  feature: document.getElementById("paywallFeature"),
  payBtn: document.getElementById("paywallPayBtn"),
  closeBtn: document.getElementById("paywallClose"),
  doneBtn: document.getElementById("paywallDone"),
};

function openPaywall(featureName) {
  paywall.feature.textContent = featureName;
  paywall.payBtn.disabled = false;
  paywall.payBtn.textContent = "Оплатить";
  paywall.success.classList.add("hidden");
  paywall.form.classList.remove("hidden");
  paywall.overlay.classList.remove("hidden");
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
  paywall.payBtn.disabled = true;
  paywall.payBtn.textContent = "Обработка платежа...";
  setTimeout(() => {
    paywall.form.classList.add("hidden");
    paywall.success.classList.remove("hidden");
  }, 1300);
});

paywall.doneBtn.addEventListener("click", closePaywall);
