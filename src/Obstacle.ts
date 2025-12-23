export class Obstacle {
    lane: number;
    y: number;
    width: number = 60;
    height: number = 60;
    speed: number;

    constructor(lane: number, speed: number) {
        this.lane = lane;
        this.y = -this.height;
        this.speed = speed;
    }

    update(deltaTime: number) {
        this.y += this.speed * deltaTime;
    }
}