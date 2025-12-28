export const LANES = 4;

export function drawLanes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
){
    const laneWidth = width / LANES;

    ctx.fillStyle = "#050505";
    ctx.strokeStyle = "#b026ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#b026ff";
    ctx.shadowBlur = 15;
    ctx.fillRect(0,0,width,height);

    for (let i = 1; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, height);
        ctx.stroke();
    }
}