import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { UIManager } from "./UIManager";
import type { IGameController } from "./GameController";

export class GameState {
	score = 0
	timeRemaining = 30
	round = 1
	forceMultiplier = 1
	spawnPoolSize = 10
	gravityMagnitude = 7
	extraBalls = 2
	gravityDirection = new Vector3(0, -0.781, -0.625)
	lastTime = performance.now();
	private uim: UIManager;
	private igc: IGameController;
	constructor(uim: UIManager, igc: IGameController) {
		this.uim = uim;
		this.igc = igc;
	}
	get currentGravity() {
		return new Vector3(0, this.gravityMagnitude * this.gravityDirection.y, this.gravityMagnitude * this.gravityDirection.z)
	}
	getDeltaTime() {
		const now = performance.now();
		const delta = (now - this.lastTime) / 1000; // Convert to seconds
		this.lastTime = now;
		return delta;
	}
	startGame() {
		this.lastTime = performance.now();
		this.igc.scene.getPhysicsEngine()?.setGravity(this.currentGravity);
		this.uim.round(this.round);
		this.uim.timeRemaining(this.timeRemaining);
		this.uim.score(this.score);
	}
	isGameOver() {
		return this.extraBalls <= 0 && this.igc.controllableBalls.length === 0;
	}
	nextRound() {
		this.round++;
		this.uim.round(this.round);
		this.timeRemaining = 30;
		this.forceMultiplier *= 1.01;
		this.spawnPoolSize++;
		this.gravityMagnitude *= 1.01;
		this.uim.timeRemaining(this.timeRemaining);
		this.igc.scene.getPhysicsEngine()?.setGravity(this.currentGravity);
	}
	scorePoints(points: number) {
		this.score += points;
		this.uim.score(this.score);
	}
	updateTimeRemaining(delta: number) {
		this.timeRemaining -= delta;
		this.uim.timeRemaining(this.timeRemaining);
		if (this.timeRemaining <= 0) {
			this.nextRound();
		}
	}
	adjustGravity(amount:Vector3) {
		this.gravityDirection.addInPlace(amount);
		this.igc.scene.getPhysicsEngine()?.setGravity(this.currentGravity);
	}
	extraTime(amount: number) {
		this.timeRemaining += amount;
		this.uim.timeRemaining(this.timeRemaining);
	}
}
