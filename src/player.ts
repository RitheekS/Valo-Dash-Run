export class Player {
  lane = 1;

  constructor(private lanes: number) {}

  moveLeft() {
    if (this.lane > 0)
        this.lane--;
  }

  moveRight() {
    if (this.lane < this.lanes - 1)
        this.lane++;
  }
}


export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  lane: number,
  lanes: number
) {
  const laneWidth = canvasWidth / lanes;
  const x = lane * laneWidth + laneWidth / 2 - 20;
  const y = canvasHeight - 120;

  ctx.fillStyle = "#3fa9f5";
  ctx.fillRect(x, y, 40, 80);
}
