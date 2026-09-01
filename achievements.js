/* Shared achievements system: registry, progress tracking, unlock toast, page renderer. */

const ACH_KEY = "amsAchievements";
const ACH_PROGRESS_KEY = "amsAchProgress";

const GAME_LABELS = { slot: "Слот-Симулятор", durak: "Дурак Онлайн", checkers: "Шашки", doom: "Doom" };
const GAME_ICONS = { slot: "🎰", durak: "🃏", checkers: "⚫", doom: "🔫" };

const ACHIEVEMENTS = [
  // Слот-Симулятор
  { id: "slot_first_spin", game: "slot", icon: "🎲", title: "Первый спин", desc: "Сделайте свой первый спин." },
  { id: "slot_triple", game: "slot", icon: "🍒", title: "Тройка", desc: "Соберите три одинаковых символа в линию." },
  { id: "slot_quad", game: "slot", icon: "🍇", title: "Каре", desc: "Соберите четыре одинаковых символа в линию." },
  { id: "slot_jackpot", game: "slot", icon: "7️⃣", title: "Джекпот", desc: "Соберите пять семёрок в одну линию." },
  { id: "slot_collector", game: "slot", icon: "🎰", title: "Коллекционер", desc: "Выиграйте хотя бы раз с каждым из 6 символов." },
  { id: "slot_card_withdraw", game: "slot", icon: "💳", title: "Инкассатор", desc: "Выведите деньги на банковскую карту." },
  { id: "slot_sbp_withdraw", game: "slot", icon: "📱", title: "Быстрый перевод", desc: "Выведите деньги через СБП." },
  { id: "slot_losing_streak", game: "slot", icon: "🌧️", title: "Чёрная полоса", desc: "Проиграйте 15 спинов подряд." },
  { id: "slot_marathon", game: "slot", icon: "🏃", title: "Марафонец", desc: "Сделайте 200 спинов." },
  { id: "slot_millionaire", game: "slot", icon: "💰", title: "Миллионер", desc: "Накопите баланс 1 000 000 ₽." },

  // Дурак Онлайн
  { id: "durak_first_win", game: "durak", icon: "🃏", title: "Первая победа", desc: "Выиграйте свою первую партию." },
  { id: "durak_win_medium", game: "durak", icon: "🥊", title: "Крепкий орешек", desc: "Выиграйте на среднем уровне сложности." },
  { id: "durak_win_hard", game: "durak", icon: "👑", title: "Гроссмейстер", desc: "Выиграйте на сложном уровне сложности." },
  { id: "durak_no_take", game: "durak", icon: "✨", title: "Чистая игра", desc: "Выиграйте партию, ни разу не взяв карты со стола." },
  { id: "durak_ace_defend", game: "durak", icon: "🅰️", title: "Козырной туз", desc: "Отбейтесь тузом от атаки бота." },
  { id: "durak_full_table", game: "durak", icon: "🎴", title: "Подкидной мастер", desc: "Доведите стол до 6 карт за один раунд." },
  { id: "durak_draw", game: "durak", icon: "🤝", title: "Ничья миром", desc: "Сыграйте партию вничью." },
  { id: "durak_no_trump_win", game: "durak", icon: "🚫", title: "Без козырей", desc: "Выиграйте партию, ни разу не сыграв козырную карту." },
  { id: "durak_marathon", game: "durak", icon: "📅", title: "Завсегдатай", desc: "Сыграйте 10 партий в Дурака." },
  { id: "durak_all_difficulties", game: "durak", icon: "🏆", title: "Три из трёх", desc: "Выиграйте на всех трёх уровнях сложности." },

  // Шашки
  { id: "checkers_first_win", game: "checkers", icon: "⚫", title: "Первая победа", desc: "Выиграйте свою первую партию." },
  { id: "checkers_win_medium", game: "checkers", icon: "🥊", title: "Крепкий орешек", desc: "Выиграйте на среднем уровне сложности." },
  { id: "checkers_win_hard", game: "checkers", icon: "👑", title: "Гроссмейстер", desc: "Выиграйте на сложном уровне сложности." },
  { id: "checkers_king", game: "checkers", icon: "⭐", title: "Дамка!", desc: "Проведите свою шашку в дамки." },
  { id: "checkers_triple_capture", game: "checkers", icon: "💥", title: "Тройной удар", desc: "Побейте 3 шашки за один ход." },
  { id: "checkers_clean_win", game: "checkers", icon: "🛡️", title: "Без потерь", desc: "Выиграйте, не потеряв ни одной своей шашки." },
  { id: "checkers_comeback", game: "checkers", icon: "🔥", title: "На последнем дыхании", desc: "Выиграйте партию, имея всего 1 шашку." },
  { id: "checkers_speedrun", game: "checkers", icon: "⚡", title: "Блицкриг", desc: "Выиграйте партию за 20 ходов или меньше." },
  { id: "checkers_marathon", game: "checkers", icon: "📅", title: "Завсегдатай", desc: "Сыграйте 10 партий в шашки." },
  { id: "checkers_all_difficulties", game: "checkers", icon: "🏆", title: "Три из трёх", desc: "Выиграйте на всех трёх уровнях сложности." },

  // Doom
  { id: "doom_first_kill", game: "doom", icon: "🔫", title: "Первая кровь", desc: "Убейте первого демона." },
  { id: "doom_50_kills", game: "doom", icon: "💀", title: "Истребитель", desc: "Убейте 50 демонов суммарно." },
  { id: "doom_200_kills", game: "doom", icon: "☠️", title: "Мясник", desc: "Убейте 200 демонов суммарно." },
  { id: "doom_win_easy", game: "doom", icon: "🎖️", title: "Морпех", desc: "Пройдите игру на лёгком уровне." },
  { id: "doom_win_medium", game: "doom", icon: "🥈", title: "Ветеран", desc: "Пройдите игру на среднем уровне." },
  { id: "doom_win_hard", game: "doom", icon: "🥇", title: "Терминатор", desc: "Пройдите игру на сложном уровне." },
  { id: "doom_no_damage_wave", game: "doom", icon: "🛡️", title: "Неуязвимый", desc: "Завершите волну, не потеряв ни одного очка здоровья." },
  { id: "doom_collector", game: "doom", icon: "🎁", title: "Мародёр", desc: "Подберите все 4 типа усилений." },
  { id: "doom_flawless_win", game: "doom", icon: "💯", title: "Ни царапины", desc: "Победите, сохранив 100% здоровья." },
  { id: "doom_marathon", game: "doom", icon: "🎮", title: "Ветеран боёв", desc: "Сыграйте 10 матчей в Doom." },
];

const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

function achLoadUnlocked() {
  try {
    return JSON.parse(localStorage.getItem(ACH_KEY)) || {};
  } catch {
    return {};
  }
}
function achSaveUnlocked(obj) {
  localStorage.setItem(ACH_KEY, JSON.stringify(obj));
}
function isAchUnlocked(id) {
  return Boolean(achLoadUnlocked()[id]);
}

function achLoadProgress() {
  try {
    return JSON.parse(localStorage.getItem(ACH_PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}
function achSaveProgress(p) {
  localStorage.setItem(ACH_PROGRESS_KEY, JSON.stringify(p));
}

function achBump(key, by = 1) {
  const p = achLoadProgress();
  p[key] = (p[key] || 0) + by;
  achSaveProgress(p);
  return p[key];
}
function achSetFlag(key, value = true) {
  const p = achLoadProgress();
  p[key] = value;
  achSaveProgress(p);
}
function achGetFlag(key) {
  return Boolean(achLoadProgress()[key]);
}
function achGetCount(key) {
  return achLoadProgress()[key] || 0;
}
function achAddToSet(key, value) {
  const p = achLoadProgress();
  const set = new Set(p[key] || []);
  set.add(value);
  p[key] = [...set];
  achSaveProgress(p);
  return p[key];
}
function achGetSet(key) {
  return achLoadProgress()[key] || [];
}

let achQueue = [];
let achShowing = false;

function unlockAchievement(id) {
  if (!ACH_BY_ID[id]) return false;
  const unlocked = achLoadUnlocked();
  if (unlocked[id]) return false;
  unlocked[id] = Date.now();
  achSaveUnlocked(unlocked);
  updateAchBadge();
  renderAchievementsPage();
  achQueue.push(id);
  if (!achShowing) processAchQueue();
  return true;
}

function updateAchBadge() {
  const count = Object.keys(achLoadUnlocked()).length;
  document.querySelectorAll(".ach-badge").forEach((el) => {
    el.textContent = `${count}/${ACHIEVEMENTS.length}`;
  });
}

function achPlayChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!achPlayChime.ctx) achPlayChime.ctx = new AC();
    const ac = achPlayChime.ctx;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = ac.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    /* audio unsupported, ignore */
  }
}

function achLaunchConfetti(container) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const canvas = document.createElement("canvas");
  canvas.className = "ach-confetti";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#d7b155", "#5c98db", "#5fcb8d", "#e37088", "#eef3f8"];
  const particles = Array.from({ length: 110 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 140,
    y: canvas.height / 2 - 40,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 4,
    size: 4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.3,
    life: 1,
  }));

  let raf;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach((p) => {
      if (p.life <= 0) return;
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life -= 0.008;
      if (p.life > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });
    if (alive) {
      raf = requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    canvas.remove();
  };
}

function processAchQueue() {
  const id = achQueue.shift();
  if (!id) {
    achShowing = false;
    return;
  }
  achShowing = true;
  const a = ACH_BY_ID[id];
  const layer = document.getElementById("achToastLayer");
  if (!layer) {
    processAchQueue();
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "ach-toast";
  wrap.innerHTML = `
    <div class="ach-toast-backdrop"></div>
    <div class="ach-toast-card">
      <div class="ach-toast-eyebrow">Достижение открыто</div>
      <div class="ach-toast-icon">${a.icon}</div>
      <div class="ach-toast-game">${GAME_LABELS[a.game]}</div>
      <div class="ach-toast-title">${a.title}</div>
      <div class="ach-toast-desc">${a.desc}</div>
    </div>
  `;
  layer.appendChild(wrap);
  achPlayChime();
  const stopConfetti = achLaunchConfetti(wrap);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    wrap.classList.add("ach-toast-out");
    if (stopConfetti) stopConfetti();
    setTimeout(() => {
      wrap.remove();
      processAchQueue();
    }, 400);
  };

  wrap.addEventListener("click", dismiss);
  requestAnimationFrame(() => wrap.classList.add("ach-toast-in"));
  setTimeout(dismiss, 4200);
}

function renderAchievementsPage() {
  const root = document.getElementById("achList");
  if (!root) return;
  const unlocked = achLoadUnlocked();
  const unlockedCount = Object.keys(unlocked).length;

  const summaryCount = document.getElementById("achSummaryCount");
  const summaryFill = document.getElementById("achSummaryFill");
  if (summaryCount) summaryCount.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length}`;
  if (summaryFill) summaryFill.style.width = `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`;

  root.innerHTML = Object.keys(GAME_LABELS)
    .map((game) => {
      const items = ACHIEVEMENTS.filter((a) => a.game === game);
      const gameUnlocked = items.filter((a) => unlocked[a.id]).length;
      const cards = items
        .map((a) => {
          const done = Boolean(unlocked[a.id]);
          const dateStr = done
            ? new Date(unlocked[a.id]).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "";
          return `
            <div class="ach-card ${done ? "ach-done" : "ach-locked"}">
              <div class="ach-card-icon">${done ? a.icon : "🔒"}</div>
              <div class="ach-card-body">
                <div class="ach-card-title">${a.title}</div>
                <div class="ach-card-desc">${a.desc}</div>
                ${done ? `<div class="ach-card-date">Открыто ${dateStr}</div>` : ""}
              </div>
            </div>`;
        })
        .join("");
      return `
        <section class="ach-group">
          <div class="ach-group-head">
            <span class="ach-group-icon">${GAME_ICONS[game]}</span>
            <h2>${GAME_LABELS[game]}</h2>
            <span class="ach-group-count">${gameUnlocked}/${items.length}</span>
          </div>
          <div class="ach-grid">${cards}</div>
        </section>`;
    })
    .join("");
}

function initAchievementsPage() {
  renderAchievementsPage();
  const resetBtn = document.getElementById("achResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Сбросить весь прогресс достижений?")) {
        localStorage.removeItem(ACH_KEY);
        localStorage.removeItem(ACH_PROGRESS_KEY);
        renderAchievementsPage();
        updateAchBadge();
      }
    });
  }
}

updateAchBadge();
