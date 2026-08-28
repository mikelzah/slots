/* Doom-style raycasting FPS mini-game */

const MAP_ROWS = [
  "1111111111111111",
  "1000000000000001",
  "1011000000001101",
  "1010000000000101",
  "1010011001100101",
  "1000011001100001",
  "1000000000000001",
  "1001100000011001",
  "1001100000011001",
  "1000000000000001",
  "1000011001100001",
  "1010011001100101",
  "1010000000000101",
  "1011000000001101",
  "1000000000000001",
  "1111111111111111",
];
const MAP = MAP_ROWS.map((row) => row.split("").map(Number));
const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

const ENEMY_SPAWNS = [
  { x: 8.5, y: 1.5 }, { x: 12.5, y: 1.5 },
  { x: 3.5, y: 3.5 }, { x: 12.5, y: 3.5 },
  { x: 2.5, y: 6.5 }, { x: 13.5, y: 6.5 },
  { x: 2.5, y: 9.5 }, { x: 13.5, y: 9.5 },
  { x: 3.5, y: 12.5 }, { x: 12.5, y: 12.5 },
  { x: 8.5, y: 14.5 },
];

const DIFFICULTY = {
  easy: { count: 4, hp: 45, speed: 1.0, dmg: 5, fireInterval: 1500, aggroRange: 6.5, label: "Лёгкий" },
  medium: { count: 6, hp: 60, speed: 1.4, dmg: 8, fireInterval: 1150, aggroRange: 8, label: "Средний" },
  hard: { count: 9, hp: 75, speed: 1.9, dmg: 12, fireInterval: 850, aggroRange: 9.5, label: "Сложный" },
};

const FOV = Math.PI / 3;
const PLAYER_SPEED = 3.1;
const TURN_SPEED = 2.6;
const MOUSE_SENS = 0.0022;
const FIRE_COOLDOWN = 260;

const canvas = document.getElementById("doomCanvas");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimapCanvas");
const mctx = minimap.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const els = {
  viewport: document.getElementById("doomViewport"),
  overlay: document.getElementById("doomOverlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  overlayBtn: document.getElementById("overlayBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  difficultyTabs: document.querySelectorAll("#difficultyTabs .method-tab"),
  healthValue: document.getElementById("healthValue"),
  killValue: document.getElementById("killValue"),
  healthBarFill: document.getElementById("healthBarFill"),
};

let difficulty = "medium";
let phase = "idle"; // idle | playing | win | lose
let player = { x: 1.5, y: 1.5, angle: 0.7, health: 100 };
let enemies = [];
let kills = 0;
let keys = {};
let zBuffer = new Array(W).fill(99);
let lastShotTime = 0;
let muzzleFlash = 0;
let damageFlash = 0;
let rafId = null;
let lastTs = 0;

const enemySprite = document.createElement("canvas");
enemySprite.width = 128;
enemySprite.height = 128;
(function drawEnemySprite() {
  const c = enemySprite.getContext("2d");
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "108px serif";
  c.fillText("👹", 64, 76);
})();

function isWallAt(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return true;
  return MAP[my][mx] === 1;
}

function attemptMove(entity, dx, dy, radius) {
  const nx = entity.x + dx;
  const ny = entity.y + dy;
  if (!isWallAt(nx + Math.sign(dx) * radius, entity.y)) entity.x = nx;
  if (!isWallAt(entity.x, ny + Math.sign(dy) * radius)) entity.y = ny;
}

function hasLineOfSight(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 0.15));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWallAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function castRay(px, py, angle) {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);
  const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
  const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
  let stepX, stepY, sideDistX, sideDistY;
  if (rayDirX < 0) { stepX = -1; sideDistX = (px - mapX) * deltaDistX; }
  else { stepX = 1; sideDistX = (mapX + 1 - px) * deltaDistX; }
  if (rayDirY < 0) { stepY = -1; sideDistY = (py - mapY) * deltaDistY; }
  else { stepY = 1; sideDistY = (mapY + 1 - py) * deltaDistY; }

  let side = 0;
  for (let i = 0; i < 64; i++) {
    if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
    else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
    if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) {
      return { dist: side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY, side };
    }
    if (MAP[mapY][mapX] === 1) {
      const dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      return { dist: Math.max(dist, 0.0001), side };
    }
  }
  return { dist: 20, side };
}

function drawWallsAndFloor() {
  ctx.fillStyle = "#2b2f38";
  ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = "#181a20";
  ctx.fillRect(0, H / 2, W, H / 2);

  for (let i = 0; i < W; i++) {
    const rayAngle = player.angle - FOV / 2 + (FOV * i) / W;
    const { dist, side } = castRay(player.x, player.y, rayAngle);
    const correctedDist = Math.max(0.0001, dist * Math.cos(rayAngle - player.angle));
    zBuffer[i] = correctedDist;
    const lineHeight = Math.min(H * 2, Math.floor(H / correctedDist));
    const drawStart = Math.floor((H - lineHeight) / 2);
    const shade = Math.max(0.22, 1 - correctedDist / 11);
    const base = side === 1 ? [140, 55, 40] : [188, 82, 52];
    const r = Math.floor(base[0] * shade);
    const g = Math.floor(base[1] * shade);
    const b = Math.floor(base[2] * shade);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(i, drawStart, 1, lineHeight);
  }
}

function drawSprites() {
  const visible = enemies
    .filter((e) => e.alive)
    .map((e) => {
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
      return { e, dist, rel };
    })
    .filter((s) => Math.abs(s.rel) < FOV / 2 + 0.35 && s.dist > 0.35)
    .sort((a, b) => b.dist - a.dist);

  for (const s of visible) {
    const screenX = (0.5 + s.rel / FOV) * W;
    const size = Math.min(H * 1.6, H / s.dist);
    const col = Math.floor(screenX);
    if (col < 0 || col >= W) continue;
    if (zBuffer[col] < s.dist - 0.3) continue;

    const x = screenX - size / 2;
    const y = H / 2 - size / 2 + size * 0.06;
    const fog = Math.max(0.3, 1 - s.dist / 11);
    ctx.save();
    ctx.globalAlpha = fog;
    ctx.drawImage(enemySprite, x, y, size, size);
    ctx.globalAlpha = 1;
    const hpRatio = Math.max(0, s.e.hp / s.e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y - 8, size, 5);
    ctx.fillStyle = hpRatio > 0.4 ? "#3aa856" : "#e2445c";
    ctx.fillRect(x, y - 8, size * hpRatio, 5);
    ctx.restore();
  }
}

function drawWeapon() {
  ctx.fillStyle = "#2e2e33";
  ctx.fillRect(W / 2 - 46, H - 74, 92, 74);
  ctx.fillStyle = "#4a4a52";
  ctx.fillRect(W / 2 - 15, H - 116, 30, 52);
  if (muzzleFlash > 0) {
    ctx.fillStyle = `rgba(255,225,120,${Math.min(1, muzzleFlash / 90)})`;
    ctx.beginPath();
    ctx.arc(W / 2, H - 126, 24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDamageFlash() {
  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(200,20,30,${Math.min(0.45, damageFlash / 260)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMinimap() {
  const size = minimap.width;
  const cell = size / MAP_W;
  mctx.clearRect(0, 0, size, size);
  mctx.fillStyle = "rgba(10,12,16,0.78)";
  mctx.fillRect(0, 0, size, size);
  mctx.fillStyle = "#5a6472";
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (MAP[y][x] === 1) mctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  enemies.forEach((e) => {
    if (!e.alive) return;
    mctx.fillStyle = "#e2445c";
    mctx.beginPath();
    mctx.arc(e.x * cell, e.y * cell, 2.6, 0, Math.PI * 2);
    mctx.fill();
  });
  mctx.save();
  mctx.translate(player.x * cell, player.y * cell);
  mctx.rotate(player.angle);
  mctx.fillStyle = "#1a73c7";
  mctx.beginPath();
  mctx.moveTo(6, 0);
  mctx.lineTo(-4, 4);
  mctx.lineTo(-4, -4);
  mctx.closePath();
  mctx.fill();
  mctx.restore();
}

function render() {
  drawWallsAndFloor();
  drawSprites();
  drawWeapon();
  drawDamageFlash();
  drawMinimap();
}

function updateHud() {
  els.healthValue.textContent = Math.max(0, Math.round(player.health));
  els.killValue.textContent = `${kills}/${enemies.length}`;
  const ratio = Math.max(0, player.health) / 100;
  els.healthBarFill.style.width = `${ratio * 100}%`;
  els.healthBarFill.classList.toggle("low", ratio <= 0.3);
}

function playShotSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playShotSound.ctx) playShotSound.ctx = new AC();
    const ac = playShotSound.ctx;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.15);
  } catch {
    /* audio unsupported, ignore */
  }
}

function shoot() {
  if (phase !== "playing") return;
  const now = performance.now();
  if (now - lastShotTime < FIRE_COOLDOWN) return;
  lastShotTime = now;
  muzzleFlash = 100;
  playShotSound();

  let best = null;
  let bestDist = Infinity;
  enemies.forEach((e) => {
    if (!e.alive) return;
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
    if (Math.abs(rel) < 0.06 && dist < bestDist && hasLineOfSight(player.x, player.y, e.x, e.y)) {
      best = e;
      bestDist = dist;
    }
  });

  if (best) {
    best.hp -= 22 + Math.random() * 18;
    if (best.hp <= 0) {
      best.alive = false;
      kills++;
      if (kills >= enemies.length) winGame();
    }
    updateHud();
  }
}

function updatePlayer(dt) {
  let dx = 0, dy = 0;
  const speed = PLAYER_SPEED * dt;
  if (keys["w"]) { dx += Math.cos(player.angle) * speed; dy += Math.sin(player.angle) * speed; }
  if (keys["s"]) { dx -= Math.cos(player.angle) * speed; dy -= Math.sin(player.angle) * speed; }
  if (keys["a"]) { dx += Math.cos(player.angle - Math.PI / 2) * speed; dy += Math.sin(player.angle - Math.PI / 2) * speed; }
  if (keys["d"]) { dx += Math.cos(player.angle + Math.PI / 2) * speed; dy += Math.sin(player.angle + Math.PI / 2) * speed; }
  if (dx || dy) attemptMove(player, dx, dy, 0.25);

  if (keys["arrowleft"]) player.angle -= TURN_SPEED * dt;
  if (keys["arrowright"]) player.angle += TURN_SPEED * dt;
}

function updateEnemies(dt) {
  const cfg = DIFFICULTY[difficulty];
  enemies.forEach((e) => {
    if (!e.alive) return;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < cfg.aggroRange && dist > 1.0) {
      const nx = dx / dist, ny = dy / dist;
      attemptMove(e, nx * cfg.speed * dt, ny * cfg.speed * dt, 0.3);
    }
    if (dist < 7.5 && hasLineOfSight(e.x, e.y, player.x, player.y)) {
      e.cooldown -= dt * 1000;
      if (e.cooldown <= 0) {
        e.cooldown = cfg.fireInterval + Math.random() * 400;
        const dmg = cfg.dmg * (0.7 + Math.random() * 0.6);
        player.health = Math.max(0, player.health - dmg);
        damageFlash = 260;
        if (player.health <= 0) loseGame();
      }
    }
  });
}

function update(dt) {
  updatePlayer(dt);
  updateEnemies(dt);
  if (muzzleFlash > 0) muzzleFlash = Math.max(0, muzzleFlash - dt * 1000 * 3);
  if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - dt * 1000);
  updateHud();
}

function loop(ts) {
  if (phase !== "playing") return;
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0);
  lastTs = ts;
  update(dt);
  render();
  rafId = requestAnimationFrame(loop);
}

function showOverlay(title, text, btnLabel) {
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.overlayBtn.textContent = btnLabel;
  els.overlay.classList.remove("hidden");
}

function hideOverlay() {
  els.overlay.classList.add("hidden");
}

function winGame() {
  phase = "win";
  if (rafId) cancelAnimationFrame(rafId);
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  showOverlay("Победа!", "Все демоны на уровне уничтожены. Отличная работа, морпех.", "Играть снова");
  recordGameResult("doom", difficulty, "win");
}

function loseGame() {
  phase = "lose";
  if (rafId) cancelAnimationFrame(rafId);
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  showOverlay("Вы погибли", `Убито демонов: ${kills} из ${enemies.length}.`, "Попробовать снова");
  recordGameResult("doom", difficulty, "loss");
}

function startGame() {
  const cfg = DIFFICULTY[difficulty];
  player = { x: 1.5, y: 1.5, angle: 0.7, health: 100 };
  enemies = ENEMY_SPAWNS.slice(0, cfg.count).map((spawn) => ({
    x: spawn.x,
    y: spawn.y,
    hp: cfg.hp,
    maxHp: cfg.hp,
    alive: true,
    cooldown: Math.random() * cfg.fireInterval,
  }));
  kills = 0;
  keys = {};
  muzzleFlash = 0;
  damageFlash = 0;
  phase = "playing";
  lastTs = 0;
  hideOverlay();
  updateHud();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

els.difficultyTabs.forEach((tab) => {
  tab.classList.toggle("active", tab.dataset.difficulty === difficulty);
  tab.addEventListener("click", () => {
    difficulty = tab.dataset.difficulty;
    els.difficultyTabs.forEach((t) => t.classList.toggle("active", t === tab));
    if (phase !== "playing") {
      const cfg = DIFFICULTY[difficulty];
      showOverlay("DOOM", `Уничтожьте всех демонов (${cfg.count}), чтобы победить.`, "Начать игру");
    }
  });
});

els.overlayBtn.addEventListener("click", startGame);
els.newGameBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (ev) => {
  const key = ev.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowleft", "arrowright", " "].includes(key) && phase === "playing") {
    ev.preventDefault();
  }
  keys[key] = true;
  if (key === " ") shoot();
});
window.addEventListener("keyup", (ev) => {
  keys[ev.key.toLowerCase()] = false;
});

canvas.addEventListener("mousedown", () => {
  if (phase !== "playing") return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  shoot();
});

document.addEventListener("mousemove", (ev) => {
  if (document.pointerLockElement === canvas && phase === "playing") {
    player.angle += ev.movementX * MOUSE_SENS;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && phase === "playing") {
    phase = "idle";
    if (rafId) cancelAnimationFrame(rafId);
    showOverlay("Пауза", "Игра приостановлена — вкладка была неактивна.", "Начать заново");
  }
});

showOverlay("DOOM", `Уничтожьте всех демонов (${DIFFICULTY[difficulty].count}), чтобы победить.`, "Начать игру");
updateHud();
initStatsPanel("doom");
