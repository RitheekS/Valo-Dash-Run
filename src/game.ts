import { drawLanes } from "./lanes";
import { drawPlayer } from "./player";
import { Player } from "./player";
import { Obstacle } from "./Obstacle";
import { Collectible } from "./collectibles";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ==================== GAME STATE ====================
const LANES = 4;
const player = new Player(LANES);

const obstacles: Obstacle[] = [];
const collectibles: Collectible[] = [];
const TAP_THRESHOLD = 0.25;
const MAX_CHARGE = 0.6;
const ATTACK_COOLDOWN = 0.4;

let lastTime = 0;
let speed = 300;
let score = 0;
let alive = true;
let attackCooldown = 0;
let isCharging = false;
let chargeTime = 0;
let phoenixHitTimer = 0;

// Phase system
enum GamePhase {
  RUNNER,
  CHASE,
}
let currentPhase = GamePhase.RUNNER;

// Spawning
let obstacleSpawnInterval = 1;
let obstacleSpawnTimer = 0;
let collectibleTimer = 0;

// Chase mechanics
let attackTimer = 0;
let warningLanes: number[] = [];
let dangerLanes: number[] = [];
let laneAttackState: "WARNING" | "DANGER" = "WARNING";

// Phoenix placeholder
const phoenix = {
  lane: 1,
  yOffset: 340,
};

// ==================== HELPERS ====================
function laneWidth() {
  return canvas.width / LANES;
}

function rectsCollide(a: any, b: any) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ==================== PHASE 1 ====================
function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANES);
  obstacles.push(new Obstacle(lane, speed));
}

function spawnCollectible() {
  const validLanes: number[] = [];

  for (let i = 0; i < LANES; i++) {
    if (!isLaneBlocked(i)) validLanes.push(i);
  }

  if (validLanes.length === 0) return;

  const lane =
    validLanes[Math.floor(Math.random() * validLanes.length)];
  collectibles.push(new Collectible(lane, speed));
}

function updateObstacles(delta: number) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update(delta);
    if (obstacles[i].y > canvas.height) obstacles.splice(i, 1);
  }
}

function updateCollectibles(delta: number) {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    collectibles[i].update(delta);
    if (collectibles[i].y > canvas.height) collectibles.splice(i, 1);
  }
}

function isLaneBlocked(lane: number): boolean {
  return obstacles.some(
    (obs) =>
      obs.lane === lane &&
      obs.y > -obs.height &&
      obs.y < canvas.height * 0.6
  );
}

// ==================== PHASE 2 ====================
function updateLaneAttack(delta: number) {
  attackTimer += delta;

  if (laneAttackState === "WARNING" && attackTimer > 0.6) {
    dangerLanes = [...warningLanes];
    warningLanes = [];
    laneAttackState = "DANGER";
    attackTimer = 0;
  }

  if (laneAttackState === "DANGER" && attackTimer > 0.4) {
    warningLanes = [];
    dangerLanes = [];
    laneAttackState = "WARNING";
    attackTimer = 0;

    const count = Math.random() > 0.6 ? 2 : 1;
    while (warningLanes.length < count) {
      const lane = Math.floor(Math.random() * LANES);
      if (!warningLanes.includes(lane)) warningLanes.push(lane);
    }
  }
}

// ==================== COLLISIONS ====================
function checkCollisions() {
  const w = laneWidth();

  const playerBox = {
    x: player.lane * w + w / 2 - 20,
    y: canvas.height - 120,
    width: 40,
    height: 80,
  };

  // Obstacle collision
  obstacles.forEach((obs) => {
    const obsBox = {
      x: obs.lane * w + w / 2 - obs.width / 2,
      y: obs.y,
      width: obs.width,
      height: obs.height,
    };

    if (rectsCollide(playerBox, obsBox)) alive = false;
  });

  // Collectibles
  collectibles.forEach((c, i) => {
    const cBox = {
      x: c.lane * w + w / 2 - c.size / 2,
      y: c.y,
      width: c.size,
      height: c.size,
    };

    if (rectsCollide(playerBox, cBox)) {
      score += c.value;
      collectibles.splice(i, 1);
    }
  });

  // Lane attack death
  if (
    currentPhase === GamePhase.CHASE &&
    dangerLanes.includes(player.lane)
  ) {
    alive = false;
  }
}

// ==================== DRAW ====================
function drawObstacles() {
  ctx.fillStyle = "#ff3b3b";
  const w = laneWidth();

  obstacles.forEach((obs) => {
    const x = obs.lane * w + w / 2 - obs.width / 2;
    ctx.fillRect(x, obs.y, obs.width, obs.height);
  });
}

function drawCollectibles() {
  ctx.fillStyle = "#ffd93d";
  const w = laneWidth();

  collectibles.forEach((c) => {
    const x = c.lane * w + w / 2 - c.size / 2;
    ctx.beginPath();
    ctx.arc(x + c.size / 2, c.y + c.size / 2, c.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPhoenix() {
  const w = laneWidth();
  const x = phoenix.lane * w + w / 2 - 20;
  const y = canvas.height - phoenix.yOffset;

  ctx.fillStyle = phoenixHitTimer > 0 ? "#ffd93d" : "#ff7a18";
  ctx.fillRect(x, y, 40, 80);
}

function drawLaneAttacks() {
  const w = laneWidth();

  // Warning lanes
  ctx.fillStyle = "rgba(255, 140, 0, 0.35)";
  warningLanes.forEach((lane) => {
    ctx.fillRect(lane * w, 0, w, canvas.height);
  });

  // Danger lanes
  ctx.fillStyle = "rgba(255, 60, 60, 0.55)";
  dangerLanes.forEach((lane) => {
    ctx.fillRect(lane * w, 0, w, canvas.height);
  });
}

// =================FIRING=======================
function fireShockBolt(charge: number) {
  const isCharged = charge >= TAP_THRESHOLD;

  if(isCharged) {
    score += 800;
  }
  else {
    score += 300;
  }

  phoenixHitTimer = 0.15;
}

// ==================== KEYS ====================
window.addEventListener("keydown", (e) => {
  if (!alive) return;

  if (e.key === "a" || e.key === "ArrowLeft") player.moveLeft();
  if (e.key === "d" || e.key === "ArrowRight") player.moveRight();
});

window.addEventListener("keydown", (e) => {
  if (!alive || currentPhase !== GamePhase.CHASE) return;

  if (e.code === "Space" && attackCooldown <= 0 && !isCharging) {
    isCharging = true;
    chargeTime = 0;
  }
});

window.addEventListener("keyup", (e) => {
  if (!alive || currentPhase !== GamePhase.CHASE) return;

  if (e.code === "Space" && isCharging) {
    fireShockBolt(chargeTime);
    isCharging = false;
    chargeTime = 0;
    attackCooldown = ATTACK_COOLDOWN;
  }
});

// ==================== GAME LOOP ====================
function gameLoop(timestamp: number) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (alive) {
    speed += delta * 20;
    score += delta * 100;
  }

  // Phase switch
  if (currentPhase === GamePhase.RUNNER && score >= 10000) {
    currentPhase = GamePhase.CHASE;
    obstacles.length = 0;
    collectibles.length = 0;
  }

  // Phase logic
  if (alive && currentPhase === GamePhase.RUNNER) {
    obstacleSpawnInterval = Math.max(0.6, 1 - score / 20000);

    obstacleSpawnTimer += delta;
    if (obstacleSpawnTimer > obstacleSpawnInterval) {
      spawnObstacle();
      obstacleSpawnTimer = 0;
    }

    collectibleTimer += delta;
    if (collectibleTimer > 1.5) {
      spawnCollectible();
      collectibleTimer = 0;
    }

    updateObstacles(delta);
    updateCollectibles(delta);
    checkCollisions();
  }

  if (alive && currentPhase === GamePhase.CHASE) {
    if (isCharging) {
      chargeTime += delta;
      chargeTime = Math.min(chargeTime, MAX_CHARGE);
    }
    
    if (attackCooldown > 0) {
      attackCooldown -= delta;
    }

    if (phoenixHitTimer > 0) {
      phoenixHitTimer -= delta;
    }
   
    phoenix.lane = player.lane;
    updateLaneAttack(delta);
    checkCollisions();
  }

  // Draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLanes(ctx, canvas.width, canvas.height);
  drawObstacles();
  drawCollectibles();
  drawPlayer(ctx, canvas.width, canvas.height, player.lane, LANES);

  if (isCharging) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      player.lane * laneWidth() + laneWidth() / 2 - 22,
      canvas.height - 122,
      44,
      84
    );
  }

  if (currentPhase === GamePhase.CHASE) {
    drawPhoenix();
    drawLaneAttacks();
    ctx.fillStyle = "#ff7a18";
    ctx.fillText("CHASE MODE", 20, 20);
  }

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${Math.floor(score)}`, 20, 50);

  if (!alive) {
    ctx.font = "48px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
