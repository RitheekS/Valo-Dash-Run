export class Collectible {
    lane: number;
    y: number;
    size = 30;
    speed: number;
    value = 500;

    constructor(lane: number, speed: number) {
        this.lane = lane;
        this.y = -this.size;
        this.speed = speed;
    }

    update(delta: number) {
        this.y += this.speed * delta;
    }
}