const STATS_KEY_PREFIX = "amsStats_";
const STATS_LEVELS = [
  ["easy", "Лёгкий"],
  ["medium", "Средний"],
  ["hard", "Сложный"],
];

function loadStats(game) {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY_PREFIX + game)) || {};
  } catch {
    return {};
  }
}

function saveStats(game, stats) {
  localStorage.setItem(STATS_KEY_PREFIX + game, JSON.stringify(stats));
}

function recordGameResult(game, difficulty, outcome) {
  const stats = loadStats(game);
  if (!stats[difficulty]) stats[difficulty] = { played: 0, wins: 0, losses: 0, draws: 0 };
  stats[difficulty].played++;
  if (outcome === "win") stats[difficulty].wins++;
  else if (outcome === "loss") stats[difficulty].losses++;
  else if (outcome === "draw") stats[difficulty].draws++;
  saveStats(game, stats);
  renderStats(game);
}

function renderStats(game) {
  const container = document.getElementById("statsPanel");
  if (!container) return;
  const stats = loadStats(game);

  container.innerHTML = STATS_LEVELS.map(([key, label]) => {
    const s = stats[key] || { played: 0, wins: 0, losses: 0, draws: 0 };
    const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    return `
      <div class="stats-row">
        <span class="stats-level">${label}</span>
        <span class="stats-cell" data-label="Партий">${s.played}</span>
        <span class="stats-cell stats-win" data-label="Побед">${s.wins}</span>
        <span class="stats-cell stats-loss" data-label="Поражений">${s.losses}</span>
        <span class="stats-cell stats-draw" data-label="Ничьих">${s.draws}</span>
        <span class="stats-cell stats-rate" data-label="% побед">${winRate}%</span>
      </div>`;
  }).join("");
}

function resetStats(game) {
  localStorage.removeItem(STATS_KEY_PREFIX + game);
  renderStats(game);
}

function initStatsPanel(game) {
  renderStats(game);
  const resetBtn = document.getElementById("statsResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Сбросить статистику по этой игре?")) resetStats(game);
    });
  }
}
