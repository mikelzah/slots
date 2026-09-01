/* Doom-style raycasting FPS mini-game */

// 3x3 grid of rooms connected by single-tile doorways, so enemies in other
// rooms are blocked by walls instead of all being in sight/range at once.
const MAP_ROWS = [
  "1111111111111111111111111",
  "1000000011100000100000001",
  "1000000011100000100000001",
  "1000000000000000100000001",
  "1000000010000000100000001",
  "1000000010000000000000001",
  "1000000010000000100000001",
  "1111011111110111111101111",
  "1000000010000000100001101",
  "1000000010000000100001101",
  "1000000000000000100000001",
  "1000000010000000100000001",
  "1000000010000000000000001",
  "1000000010000000100000001",
  "1110111111101111111011111",
  "1110000010000110100000001",
  "1110000010000110100000001",
  "1000000000000000100000001",
  "1000000010000000100000001",
  "1000000010000000000000001",
  "1000000010000000100000001",
  "1111111111111111111111111",
];
const MAP = MAP_ROWS.map((row) => row.split("").map(Number));
const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

// Ordered farthest-from-spawn first, so small early waves spawn far away
// from the player instead of dropping most enemies right next to them.
const ENEMY_SPAWNS = [
  { x: 21.5, y: 19.5 },
  { x: 19.5, y: 16.5 },
  { x: 21.5, y: 12.5 },
  { x: 21.5, y: 5.5 },
  { x: 10.5, y: 19.5 },
  { x: 19.5, y: 9.5 },
  { x: 12.5, y: 17.5 },
  { x: 5.5, y: 19.5 },
  { x: 19.5, y: 2.5 },
  { x: 3.5, y: 16.5 },
  { x: 12.5, y: 10.5 },
  { x: 5.5, y: 12.5 },
  { x: 12.5, y: 2.5 },
  { x: 10.5, y: 5.5 },
  { x: 3.5, y: 9.5 },
  { x: 6.5, y: 5.5 },
];

const POWERUP_SPAWNS = [
  { x: 2.5, y: 5.5 },
  { x: 14.5, y: 2.5 },
  { x: 18.5, y: 5.5 },
  { x: 6.5, y: 10.5 },
  { x: 10.5, y: 12.5 },
  { x: 18.5, y: 12.5 },
  { x: 6.5, y: 16.5 },
  { x: 14.5, y: 19.5 },
  { x: 18.5, y: 19.5 },
];

const POWERUP_TYPES = {
  heal25: { label: "Аптечка +25%", color: "#3aa856", icon: "+25" },
  heal50: { label: "Аптечка +50%", color: "#2ecc71", icon: "+50" },
  damage: { label: "Усиленные пули", color: "#ffb020", icon: "⚡" },
  invis: { label: "Невидимость", color: "#7b4fe0", icon: "◐" },
};
const POWERUP_TYPE_KEYS = Object.keys(POWERUP_TYPES);
const PICKUP_RADIUS = 0.55;
const BUFF_DURATION_MS = 3000;
const PICKUP_LIFETIME_MS = 14000;
const DAMAGE_BOOST_MULT = 1.8;
const PATROL_SPEED_MULT = 0.55;

const DIFFICULTY = {
  easy: { waves: [8, 10, 12], hp: 40, speed: 1.0, dmg: 5, fireInterval: 1500, aggroRange: 6.5, label: "Лёгкий" },
  medium: { waves: [12, 16, 20], hp: 50, speed: 1.4, dmg: 8, fireInterval: 1150, aggroRange: 8, label: "Средний" },
  hard: { waves: [18, 24, 32], hp: 60, speed: 1.9, dmg: 12, fireInterval: 850, aggroRange: 9.5, label: "Сложный" },
};

function totalEnemiesFor(cfg) {
  return cfg.waves.reduce((sum, n) => sum + n, 0);
}

const FOV = Math.PI / 3;
const PLAYER_SPEED = 3.1;
const TURN_SPEED = 2.6;
const MOUSE_SENS = 0.0022;
const FIRE_COOLDOWN = 260;
const START_GRACE_MS = 3000;
const WAVE_GRACE_MS = 1500;
const WAVE_INTERMISSION_MS = 3000;

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
  waveValue: document.getElementById("waveValue"),
  healthBarFill: document.getElementById("healthBarFill"),
};

let difficulty = "medium";
let phase = "idle"; // idle | playing | win | lose
let player = { x: 2.5, y: 2.5, angle: 0.6, health: 100 };
let enemies = [];
let pickups = [];
let waveIndex = 0;
let totalKills = 0;
let waveStartHealth = 100;
let waveClearHandled = false;
let graceUntil = 0;
let intermissionUntil = 0;
let damageBoostUntil = 0;
let invisibleUntil = 0;
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
  for (let i = 0; i < 128; i++) {
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
  return { dist: 40, side };
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
  const cellW = size / MAP_W;
  const cellH = size / MAP_H;
  mctx.clearRect(0, 0, size, size);
  mctx.fillStyle = "rgba(10,12,16,0.78)";
  mctx.fillRect(0, 0, size, size);
  mctx.fillStyle = "#5a6472";
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (MAP[y][x] === 1) mctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }
  pickups.forEach((p) => {
    mctx.fillStyle = POWERUP_TYPES[p.type].color;
    mctx.beginPath();
    mctx.arc(p.x * cellW, p.y * cellH, 1.8, 0, Math.PI * 2);
    mctx.fill();
  });
  enemies.forEach((e) => {
    if (!e.alive) return;
    mctx.fillStyle = "#e2445c";
    mctx.beginPath();
    mctx.arc(e.x * cellW, e.y * cellH, 2.2, 0, Math.PI * 2);
    mctx.fill();
  });
  mctx.save();
  mctx.translate(player.x * cellW, player.y * cellH);
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

function drawPickups() {
  const visible = pickups
    .map((p) => {
      const dx = p.x - player.x, dy = p.y - player.y;
      const dist = Math.hypot(dx, dy);
      const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
      return { p, dist, rel };
    })
    .filter((s) => Math.abs(s.rel) < FOV / 2 + 0.35 && s.dist > 0.3)
    .sort((a, b) => b.dist - a.dist);

  for (const s of visible) {
    const screenX = (0.5 + s.rel / FOV) * W;
    const size = Math.min(H * 0.5, H / s.dist * 0.45);
    const col = Math.floor(screenX);
    if (col < 0 || col >= W) continue;
    if (zBuffer[col] < s.dist - 0.3) continue;

    const type = POWERUP_TYPES[s.p.type];
    const cx = screenX, cy = H / 2 + size * 0.4;
    const fog = Math.max(0.35, 1 - s.dist / 11);
    const bob = Math.sin(performance.now() / 260 + s.p.x * 3) * size * 0.08;
    ctx.save();
    ctx.globalAlpha = fog;
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#0d0d10";
    ctx.font = `bold ${Math.max(9, size * 0.32)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(type.icon, cx, cy + bob + 1);
    ctx.restore();
  }
}

function drawBuffIndicators() {
  const now = performance.now();
  const active = [];
  if (now < damageBoostUntil) active.push({ text: `⚡ Усиленные пули ${((damageBoostUntil - now) / 1000).toFixed(1)}с`, color: "#ffb020" });
  if (now < invisibleUntil) active.push({ text: `◐ Невидимость ${((invisibleUntil - now) / 1000).toFixed(1)}с`, color: "#7b4fe0" });
  if (!active.length) return;
  ctx.save();
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.textAlign = "left";
  active.forEach((a, i) => {
    const y = H - 96 - i * 20;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(10, y - 14, ctx.measureText(a.text).width + 14, 20);
    ctx.fillStyle = a.color;
    ctx.fillText(a.text, 17, y);
  });
  ctx.restore();
}

function drawBanner() {
  const now = performance.now();
  let text = null;
  if (now < graceUntil) {
    text = `Приготовьтесь! ${Math.max(0, (graceUntil - now) / 1000).toFixed(1)}с`;
  } else if (intermissionUntil) {
    text = `Волна ${waveIndex + 2} через ${Math.max(0, (intermissionUntil - now) / 1000).toFixed(1)}с`;
  }
  if (!text) return;
  ctx.save();
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 36, W, 40);
  ctx.fillStyle = "#ffe678";
  ctx.fillText(text, W / 2, 62);
  ctx.restore();
}

function render() {
  drawWallsAndFloor();
  drawPickups();
  drawSprites();
  drawWeapon();
  drawDamageFlash();
  drawBuffIndicators();
  drawBanner();
  drawMinimap();
}

function updateHud() {
  const cfg = DIFFICULTY[difficulty];
  els.healthValue.textContent = Math.max(0, Math.round(player.health));
  els.killValue.textContent = `${totalKills}/${totalEnemiesFor(cfg)}`;
  els.waveValue.textContent = `${Math.min(waveIndex + 1, cfg.waves.length)}/${cfg.waves.length}`;
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
    const boosted = performance.now() < damageBoostUntil;
    let dmg = 22 + Math.random() * 18;
    if (boosted) dmg *= DAMAGE_BOOST_MULT;
    best.hp -= dmg;
    if (best.hp <= 0) {
      best.alive = false;
      totalKills++;
      unlockAchievement("doom_first_kill");
      const cumulativeKills = achBump("doomTotalKills");
      if (cumulativeKills >= 50) unlockAchievement("doom_50_kills");
      if (cumulativeKills >= 200) unlockAchievement("doom_200_kills");
    }
    updateHud();
  }
}

function applyPowerup(type) {
  if (type === "heal25") player.health = Math.min(100, player.health + 25);
  else if (type === "heal50") player.health = Math.min(100, player.health + 50);
  else if (type === "damage") damageBoostUntil = performance.now() + BUFF_DURATION_MS;
  else if (type === "invis") invisibleUntil = performance.now() + BUFF_DURATION_MS;
  const collected = achAddToSet("doomPowerupTypes", type);
  if (collected.length >= POWERUP_TYPE_KEYS.length) unlockAchievement("doom_collector");
}

function respawnPickup(p) {
  const spawn = POWERUP_SPAWNS[Math.floor(Math.random() * POWERUP_SPAWNS.length)];
  p.x = spawn.x;
  p.y = spawn.y;
  p.type = POWERUP_TYPE_KEYS[Math.floor(Math.random() * POWERUP_TYPE_KEYS.length)];
  p.expiresAt = performance.now() + PICKUP_LIFETIME_MS;
}

function updatePickups() {
  const now = performance.now();
  pickups.forEach((p) => {
    if (Math.hypot(p.x - player.x, p.y - player.y) < PICKUP_RADIUS) {
      applyPowerup(p.type);
      respawnPickup(p);
    } else if (now > p.expiresAt) {
      respawnPickup(p);
    }
  });
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

function updateEnemyWander(e, dt) {
  // Enemies keep moving at all times; while they can't see the player they
  // wander in a random direction, picking a new one whenever the old one
  // times out or runs them straight into a wall.
  e.wanderCooldown -= dt * 1000;
  if (e.wanderCooldown <= 0) {
    e.wanderAngle = Math.random() * Math.PI * 2;
    e.wanderCooldown = 1800 + Math.random() * 2200;
  }
  const beforeX = e.x, beforeY = e.y;
  const speed = e.speed * PATROL_SPEED_MULT * dt;
  attemptMove(e, Math.cos(e.wanderAngle) * speed, Math.sin(e.wanderAngle) * speed, 0.3);
  if (Math.abs(e.x - beforeX) < 1e-4 && Math.abs(e.y - beforeY) < 1e-4) e.wanderCooldown = 0;
}

function updateEnemies(dt) {
  const cfg = DIFFICULTY[difficulty];
  const invisible = performance.now() < invisibleUntil;
  enemies.forEach((e) => {
    if (!e.alive) return;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const canSeePlayer = !invisible && dist < cfg.aggroRange && hasLineOfSight(e.x, e.y, player.x, player.y);

    if (!canSeePlayer) {
      updateEnemyWander(e, dt);
      return;
    }

    if (dist > 1.0) {
      const nx = dx / dist, ny = dy / dist;
      attemptMove(e, nx * e.speed * dt, ny * e.speed * dt, 0.3);
    }
    if (dist < 7.5) {
      e.cooldown -= dt * 1000;
      if (e.cooldown <= 0) {
        e.cooldown = e.fireInterval + Math.random() * 400;
        const dmg = e.dmg * (0.7 + Math.random() * 0.6);
        player.health = Math.max(0, player.health - dmg);
        damageFlash = 260;
        if (player.health <= 0) loseGame();
      }
    }
  });
}

function checkWaveProgress(now) {
  if (phase !== "playing") return;
  const cfg = DIFFICULTY[difficulty];
  const waveCleared = enemies.length > 0 && enemies.every((e) => !e.alive);
  if (!waveCleared) return;

  if (!waveClearHandled) {
    waveClearHandled = true;
    if (player.health >= waveStartHealth) unlockAchievement("doom_no_damage_wave");
  }

  if (waveIndex + 1 >= cfg.waves.length) {
    winGame();
    return;
  }
  if (!intermissionUntil) {
    intermissionUntil = now + WAVE_INTERMISSION_MS;
  } else if (now >= intermissionUntil) {
    waveIndex++;
    spawnWave(waveIndex);
    intermissionUntil = 0;
  }
}

function update(dt) {
  const now = performance.now();
  updatePlayer(dt);
  if (now >= graceUntil) updateEnemies(dt);
  updatePickups();
  checkWaveProgress(now);
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
  if (achBump("doomGamesPlayed") >= 10) unlockAchievement("doom_marathon");
  if (difficulty === "easy") unlockAchievement("doom_win_easy");
  if (difficulty === "medium") unlockAchievement("doom_win_medium");
  if (difficulty === "hard") unlockAchievement("doom_win_hard");
  if (player.health >= 100) unlockAchievement("doom_flawless_win");
}

function loseGame() {
  phase = "lose";
  if (rafId) cancelAnimationFrame(rafId);
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  const cfg = DIFFICULTY[difficulty];
  showOverlay("Вы погибли", `Убито демонов: ${totalKills} из ${totalEnemiesFor(cfg)}.`, "Попробовать снова");
  recordGameResult("doom", difficulty, "loss");
  if (achBump("doomGamesPlayed") >= 10) unlockAchievement("doom_marathon");
}

function jitteredSpawn(base) {
  // Many enemies can share the same base spawn point, so nudge them apart
  // to a nearby floor cell instead of stacking exactly on top of each other.
  for (let i = 0; i < 6; i++) {
    const jx = base.x + (Math.random() - 0.5) * 1.6;
    const jy = base.y + (Math.random() - 0.5) * 1.6;
    if (!isWallAt(jx, jy)) return { x: jx, y: jy };
  }
  return { x: base.x, y: base.y };
}

function spawnsForWave(count, cumulativeBefore) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push(jitteredSpawn(ENEMY_SPAWNS[(cumulativeBefore + i) % ENEMY_SPAWNS.length]));
  }
  return list;
}

function spawnWave(idx) {
  const cfg = DIFFICULTY[difficulty];
  const count = cfg.waves[idx];
  const cumulativeBefore = cfg.waves.slice(0, idx).reduce((sum, n) => sum + n, 0);
  const scale = 1 + idx * 0.15;
  const hp = cfg.hp * scale;
  enemies = spawnsForWave(count, cumulativeBefore).map((spawn) => ({
    x: spawn.x,
    y: spawn.y,
    hp,
    maxHp: hp,
    speed: cfg.speed * (1 + idx * 0.08),
    dmg: cfg.dmg * (1 + idx * 0.1),
    fireInterval: cfg.fireInterval,
    alive: true,
    cooldown: Math.random() * cfg.fireInterval,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderCooldown: Math.random() * 2000,
  }));
  graceUntil = performance.now() + (idx === 0 ? START_GRACE_MS : WAVE_GRACE_MS);
  waveStartHealth = player.health;
  waveClearHandled = false;
}

function spawnPickups() {
  pickups = POWERUP_SPAWNS.map((spawn) => ({
    x: spawn.x,
    y: spawn.y,
    type: POWERUP_TYPE_KEYS[Math.floor(Math.random() * POWERUP_TYPE_KEYS.length)],
    expiresAt: performance.now() + Math.random() * PICKUP_LIFETIME_MS,
  }));
}

function startGame() {
  player = { x: 2.5, y: 2.5, angle: 0.6, health: 100 };
  waveIndex = 0;
  totalKills = 0;
  intermissionUntil = 0;
  damageBoostUntil = 0;
  invisibleUntil = 0;
  keys = {};
  muzzleFlash = 0;
  damageFlash = 0;
  phase = "playing";
  lastTs = 0;
  spawnWave(0);
  spawnPickups();
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
      showOverlay("DOOM", `${cfg.waves.length} волны демонов, всего ${totalEnemiesFor(cfg)}. После старта у вас есть пара секунд, чтобы осмотреться.`, "Начать игру");
    }
  });
});

els.overlayBtn.addEventListener("click", startGame);
els.newGameBtn.addEventListener("click", startGame);

const KEY_CODE_MAP = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  ArrowLeft: "arrowleft",
  ArrowRight: "arrowright",
  Space: " ",
};

function resolveKey(ev) {
  // Use the physical key code (layout-independent) so WASD keeps working
  // even when the OS keyboard layout is non-Latin (e.g. Russian ЙЦУКЕН).
  return KEY_CODE_MAP[ev.code] || ev.key.toLowerCase();
}

window.addEventListener("keydown", (ev) => {
  const key = resolveKey(ev);
  if (["w", "a", "s", "d", "arrowleft", "arrowright", " "].includes(key) && phase === "playing") {
    ev.preventDefault();
  }
  keys[key] = true;
  if (key === " ") shoot();
});
window.addEventListener("keyup", (ev) => {
  keys[resolveKey(ev)] = false;
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

showOverlay("DOOM", `${DIFFICULTY[difficulty].waves.length} волны демонов, всего ${totalEnemiesFor(DIFFICULTY[difficulty])}. После старта у вас есть пара секунд, чтобы осмотреться.`, "Начать игру");
updateHud();
initStatsPanel("doom");
