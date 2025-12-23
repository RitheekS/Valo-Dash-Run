import { drawLanes } from "./lanes";
import { drawPlayer } from "./player";
import { Player } from "./player";
import { Obstacle } from "./Obstacle";
import { Collectible } from "./collectibles";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -------------------- GAME STATE --------------------
const LANES = 4;
const player = new Player(LANES);
const obstacles: Obstacle[] = [];

let lastTime = 0;
let speed = 300;
let score = 0;
let alive = true;
let spawnTimer = 0;
let phase2Active = false;
let obstacleSpawnInterval = 1;
let obstacleSpawnTimer = 0;

// -------------------- HELPERS --------------------
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

// -------------------- OBSTACLES --------------------
function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANES);
  obstacles.push(new Obstacle(lane, speed));
}

function updateObstacles(delta: number) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update(delta);

    if (obstacles[i].y > canvas.height) {
      obstacles.splice(i, 1);
    }
  }
}

function drawObstacles() {
  ctx.fillStyle = "#ff3b3b";
  const w = laneWidth();

  obstacles.forEach((obs) => {
    const x = obs.lane * w + w / 2 - obs.width / 2;
    ctx.fillRect(x, obs.y, obs.width, obs.height);
  });
}
// --------------------COLLECTIBLES-------------------
const collectibles: Collectible[] = [];
let collectibleTimer = 0;

function spawnCollectibles() {
  const availableLanes: number[] = [];

  for (let i = 0; i < LANES; i++) {
    if (!isLaneBlocked(i)) {
      availableLanes.push(i);
    }
  }

  if (availableLanes.length === 0) return;

  const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
  collectibles.push(new Collectible(lane, speed));
}

function updateCollectibles(delta: number) {
    for (let i = collectibles.length - 1; i >= 0; i--) {
        collectibles[i].update(delta);

        if (collectibles[i].y > canvas.height) {
            collectibles.splice(i, 1);
        }
    }
}

function drawCollectibles() {
    ctx.fillStyle = "#ffd93d";
    const w = laneWidth();

    collectibles.forEach((c) => {
        const x = c.lane * w + w /2 - c.size / 2;
        ctx.beginPath();
        ctx.arc(x + c.size / 2, c.y + c.size / 2, c.size / 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

// -------------------- COLLISION --------------------
function checkCollisions() {
  const w = laneWidth();

  const playerBox = {
    x: player.lane * w + w / 2 - 20,
    y: canvas.height - 120,
    width: 40,
    height: 80,
  };

  // obstacle collisions
  obstacles.forEach((obs) => {
    const obsBox = {
      x: obs.lane * w + w / 2 - obs.width / 2,
      y: obs.y,
      width: obs.width,
      height: obs.height,
    };

    if (rectsCollide(playerBox, obsBox)) {
      alive = false;
    }
  });

  // collectible collisions
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
}
// ------------------Lane Block?------------------
function isLaneBlocked(lane: number): boolean {
    return obstacles.some((obs) => {
        return (
            obs.lane === lane &&
            obs.y > -100 &&
            obs.y < canvas.height * 0.6 
        )
    });
}

// -------------------- INPUT --------------------
window.addEventListener("keydown", (e) => {
  if (!alive)
    return;

  if (e.key === "a" || e.key === "ArrowLeft")
    player.moveLeft();

  if (e.key === "d" || e.key === "ArrowRight")
    player.moveRight();
});

// -------------------- GAME LOOP --------------------
function gameLoop(timestamp: number) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  const SCORE_LIMIT_FOR_RUNNING = 10000;
  if (alive) {
    speed += delta * 20;
    score += delta * 100;
    obstacleSpawnInterval = Math.max(0.6, 1 - score / 20000);

    obstacleSpawnTimer += delta;
    if (obstacleSpawnTimer > obstacleSpawnInterval) {
      spawnObstacle();
      obstacleSpawnTimer = 0;
    }

    collectibleTimer += delta;
    if (collectibleTimer > 1.5) {
      spawnCollectibles();
      collectibleTimer = 0;
    }

    if (score >= SCORE_LIMIT_FOR_RUNNING) {
        phase2Active = true;
    }

    updateObstacles(delta);
    updateCollectibles(delta);
    checkCollisions();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawLanes(ctx, canvas.width, canvas.height);
  drawObstacles();
  drawCollectibles();
  drawPlayer(ctx, canvas.width, canvas.height, player.lane, LANES);
  
  // UI
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${Math.floor(score)}`, 20, 30);
  ctx.fillText(`Speed: ${Math.floor(speed)}`, 20, 60);

  if (phase2Active) {
    ctx.font = "24px Arial";
    ctx.fillText("PHASE 2 READY", canvas.width / 2 - 100, 80);
  }

  if (!alive) {
    ctx.font = "48px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);