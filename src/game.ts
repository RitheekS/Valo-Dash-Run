import { drawLanes } from "./lanes";
import { drawPlayer } from "./player";
import { Player } from "./player";
import { Obstacle } from "./Obstacle";
import { Collectible } from "./collectibles";
import conn from "../db/supabase-config";
import { SoundManager } from "./audioManager";

/* ==================== SETUP ==================== */
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* ==================== CONSTANTS ==================== */
const LANES = 4;
const PHASE_2_SCORE = 10000;

const TAP_THRESHOLD = 0.25;
const ATTACK_COOLDOWN = 0.4;

/* ==================== STATE ==================== */
const player = new Player(LANES);
const obstacles: Obstacle[] = [];
const collectibles: Collectible[] = [];
const pulse = 0.3 + Math.sin(performance.now() / 120) * 0.15;

let lastTime = 0;
let speed = 300;
let score = 0;
let alive = true;
let gameStarted = false;

/* Tutorial Overlay */
const tutorialOverlay = document.getElementById("tutorial-overlay") as HTMLElement;

/* Shock Bolt */
let isCharging = false;
let chargeTime = 0;
let attackCooldown = 0;
let phoenixHitTimer = 0;

/* Phoenix Blind */
let blindTimer = 0;
let blindCooldown = 0;

/* Screen Shake */
let shakeTimer = 0;

/* Phase */
enum GamePhase {
  RUNNER,
  CHASE
}
let phase = GamePhase.RUNNER;

/* Spawning */
let obstacleTimer = 0;
let obstacleInterval = 1;
let collectibleTimer = 0;

/* Leaderboard */
let scoreSubmitted = false;
let leaderboardData: { score: number }[] | null = null;

/* Lane Attacks */
let warningLanes: number[] = [];
let dangerLanes: number[] = [];
let attackTimer = 0;
let attackState: "WARNING" | "DANGER" = "WARNING";

/* Score PopUp */
type ScorePopUp = {
  x: number;
  y: number;
  value: number;
  life: number;
};
const scorePopUps: ScorePopUp[] = [];

/* Phoenix */
const phoenix = { lane: 1, offsetY: 340 };

/* Sound Manager */
const soundManager = new SoundManager();

/* ==================== HELPERS ==================== */
const laneWidth = () => canvas.width / LANES;

const rectsCollide = (a: any, b: any) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

/* ==================== PHASE 1 ==================== */
function spawnObstacle() {
  obstacles.push(new Obstacle(Math.floor(Math.random() * LANES), speed));
}

function spawnCollectible() {
  const valid = [...Array(LANES).keys()].filter(
    lane => !obstacles.some(o => o.lane === lane && o.y < canvas.height * 0.6)
  );
  if (valid.length)
    collectibles.push(new Collectible(valid[Math.floor(Math.random() * valid.length)], speed));
}

function updateObstacles(dt: number) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update(dt);
    if (obstacles[i].y > canvas.height) obstacles.splice(i, 1);
  }
}

function updateCollectibles(dt: number) {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    collectibles[i].update(dt);
    if (collectibles[i].y > canvas.height) collectibles.splice(i, 1);
  }
}

/* ==================== PHASE 2 ==================== */
function updateLaneAttacks(dt: number) {
  attackTimer += dt;

  if (attackState === "WARNING" && attackTimer > 0.6) {
    dangerLanes = [...warningLanes];
    warningLanes = [];
    attackState = "DANGER";
    attackTimer = 0;
    shakeTimer = 0.15;
    ctx.fillStyle = `rgba(244, 140, 0, ${pulse})`;
    soundManager.playSound('redLanes');
  }

  if (attackState === "DANGER" && attackTimer > 0.4) {
    dangerLanes = [];
    attackState = "WARNING";
    attackTimer = 0;

    while (warningLanes.length < (Math.random() > 0.6 ? 2 : 1)) {
      const l = Math.floor(Math.random() * LANES);
      if (!warningLanes.includes(l)) warningLanes.push(l);
    }
  }
}

/* ==================== COMBAT ==================== */
function fireShockBolt(charge: number) {
  score += charge >= TAP_THRESHOLD ? 800 : 300;
  phoenixHitTimer = charge >= TAP_THRESHOLD ? 0.25 : 0.15;
  soundManager.playSound('playerAttack');
}

/* ==================== COLLISIONS ==================== */
function checkCollisions() {
  const w = laneWidth();
  const playerBox = {
    x: player.lane * w + w / 2 - 20,
    y: canvas.height - 120,
    width: 40,
    height: 80
  };

  obstacles.forEach(o => {
    const box = { x: o.lane * w + w / 2 - o.width / 2, y: o.y, width: o.width, height: o.height };
    if (rectsCollide(playerBox, box)) {
      soundManager.playSound('obstacleHit');
      die();
    }
  });

  collectibles.forEach((c, i) => {
    const box = { x: c.lane * w + w / 2 - c.size / 2, y: c.y, width: c.size, height: c.size };
    if (rectsCollide(playerBox, box)) {
      score += c.value;

      scorePopUps.push({
        x: c.lane * w + w / 2,
        y: c.y,
        value: c.value,
        life: 0.6
      });

      soundManager.playSound('collectCoin');
      collectibles.splice(i, 1);
    }
  });

  if (phase === GamePhase.CHASE && dangerLanes.includes(player.lane)) {
    soundManager.playSound('killedByEnemy');
    die();
  }
}

function die() {
  alive = false;
  shakeTimer = 0.3;
}

// ============= GLOW EFFECT =================
export function glowRect(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  blur = 20,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ============== LEADERBOARD =================
async function submitScore(finalScore: number) {
  if (scoreSubmitted)
    return;

  scoreSubmitted = true;

  const { error } = await conn.from("leaderboard").insert([{
    score: finalScore
  }]);

  if (error) {
    console.error("Error submitting score:", error);
  } else {
    await fetchLeaderboard();
  }
}

async function fetchLeaderboard() {
  const { data, error } = await conn
    .from("leaderboard")
    .select("score")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching leaderboard:", error);
  } else {
    leaderboardData = data;
  }
}

/* ==================== DRAW ==================== */
function drawWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let sx = 0, sy = 0;
  if (shakeTimer > 0) {
    sx = (Math.random() - 0.5) * 10;
    sy = (Math.random() - 0.5) * 10;
    shakeTimer -= 1 / 60;
  }

  ctx.save();
  ctx.translate(sx, sy);

  drawLanes(ctx, canvas.width, canvas.height);
  obstacles.forEach(o => glowRect(
    o.lane * laneWidth() + laneWidth() / 2 - o.width / 2,
    o.y,
    o.width,
    o.height,
    "#ff3b3b",
    20
  ));

  collectibles.forEach(c => glowRect(
    c.lane * laneWidth() + laneWidth() / 2 - c.size / 2,
    c.y,
    c.size,
    c.size,
    "#ffd93d",
    20
  ));

  drawPlayer(ctx, canvas.width, canvas.height, player.lane, LANES);

  scorePopUps.forEach(p => {
    ctx.globalAlpha = Math.max(p.life / 0.6, 0);
    ctx.fillStyle = p.value >= 800 ? "#ffd93d" : "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText(`+${p.value}`, p.x - 12, p.y);
    ctx.globalAlpha = 1;
  });

  if (phase === GamePhase.CHASE) {
    drawPhoenix();
    drawLaneAttacks();
  }

  ctx.restore();

  // Draw flashbang blind effect (outside of shake transform)
  if (blindTimer > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawPhoenix() {
  const phoenixColor = phoenixHitTimer > 0 ? "#ffd93d" : "#ff7a18";
  glowRect(
    phoenix.lane * laneWidth() + laneWidth() / 2 - 20,
    canvas.height - phoenix.offsetY,
    40, 80,
    phoenixColor,
    25
  );
}

function drawLaneAttacks() {
  ctx.fillStyle = "rgba(255,140,0,0.35)";
  warningLanes.forEach(l => ctx.fillRect(l * laneWidth(), 0, laneWidth(), canvas.height));
  ctx.fillStyle = "rgba(255,60,60,0.55)";
  dangerLanes.forEach(l => ctx.fillRect(l * laneWidth(), 0, laneWidth(), canvas.height));
}

/* ==================== INPUT ==================== */
window.addEventListener("keydown", e => {
  // Start game with 'S' key
  if (!gameStarted && (e.key === "s" || e.key === "S")) {
    gameStarted = true;
    tutorialOverlay.style.display = "none";
    soundManager.playBGM('phase1BGM');
    lastTime = performance.now();
    return;
  }

  if (!gameStarted || !alive) return;
  if (e.key === "a" || e.key === "ArrowLeft") player.moveLeft();
  if (e.key === "d" || e.key === "ArrowRight") player.moveRight();
  if (e.code === "Space" && phase === GamePhase.CHASE && attackCooldown <= 0 && !isCharging) {
    isCharging = true;
    chargeTime = 0;
  }
});

window.addEventListener("keyup", e => {
  if (!gameStarted) return;
  if (e.code === "Space" && isCharging) {
    fireShockBolt(chargeTime);
    isCharging = false;
    attackCooldown = ATTACK_COOLDOWN;
  }
});

window.addEventListener("keydown", e => {
  if (e.key === "r" && !alive) reset();
});

/* ==================== RESET ==================== */
function reset() {
  alive = true;
  score = 0;
  speed = 300;
  phase = GamePhase.RUNNER;
  obstacles.length = 0;
  collectibles.length = 0;
  warningLanes = [];
  dangerLanes = [];
  isCharging = false;
  chargeTime = 0;
  attackCooldown = phoenixHitTimer = 0;
  blindTimer = blindCooldown = shakeTimer = 0;
  scoreSubmitted = false;
  leaderboardData = null;
  gameStarted = false;
  tutorialOverlay.style.display = "flex";
  soundManager.stopAll(); // Stop all sounds on reset
}

/* ==================== LOOP ==================== */
function loop(t: number) {
  if (!gameStarted) {
    requestAnimationFrame(loop);
    return;
  }

  const dt = (t - lastTime) / 1000;
  lastTime = t;

  if (alive) {
    speed += dt * 20;
    score += dt * 100;
  }

  if (phase === GamePhase.RUNNER && score >= PHASE_2_SCORE) {
    phase = GamePhase.CHASE;
    obstacles.length = collectibles.length = 0;
    soundManager.playBGM('phase2BGM');
  }

  if (alive && phase === GamePhase.RUNNER) {
    obstacleInterval = Math.max(0.6, 1 - score / 20000);
    obstacleTimer += dt;
    if (obstacleTimer > obstacleInterval) {
      spawnObstacle();
      obstacleTimer = 0;
    }
    collectibleTimer += dt;
    if (collectibleTimer > 1.5) {
      spawnCollectible();
      collectibleTimer = 0;
    }

    for (let i = scorePopUps.length - 1; i >= 0; i--) {
      scorePopUps[i].y -= 40 * dt;
      scorePopUps[i].life -= dt;
      if (scorePopUps[i].life <= 0) scorePopUps.splice(i, 1);
    }

    updateObstacles(dt);
    updateCollectibles(dt);
    checkCollisions();
  }

  if (alive && phase === GamePhase.CHASE) {
    phoenix.lane = player.lane;
    updateLaneAttacks(dt);
    checkCollisions();
    if (attackCooldown > 0) attackCooldown -= dt;
    if (phoenixHitTimer > 0) phoenixHitTimer -= dt;

    // Phoenix Blind Logic
    if (blindTimer > 0) {
      blindTimer -= dt;
    }
    if (blindCooldown > 0) {
      blindCooldown -= dt;
    } else {
      // Trigger blind every 6 seconds
      blindTimer = 0.6; // 0.6 second blind duration
      blindCooldown = 6; // 6 second cooldown
      soundManager.playSound('flashbang');
    }

  }

  drawWorld();

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${Math.floor(score)}`, 20, 40);

  if (!alive) {
    submitScore(Math.floor(score));

    ctx.font = "48px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2 - 100);
    ctx.font = "24px Arial";
    ctx.fillText(`Final Score: ${Math.floor(score)}`, canvas.width / 2 - 150, canvas.height / 2 - 50);

    // Display leaderboard
    if (leaderboardData) {
      ctx.font = "20px Arial";
      ctx.fillText("TOP 10 SCORES", canvas.width / 2 - 80, canvas.height / 2 + 10);
      leaderboardData.forEach((entry, i) => {
        ctx.fillText(`${i + 1}. ${entry.score}`, canvas.width / 2 - 80, canvas.height / 2 + 40 + i * 25);
      });
    }

    ctx.font = "24px Arial";
    ctx.fillText("Press R to Restart", canvas.width / 2 - 150, canvas.height / 2 + 320);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);