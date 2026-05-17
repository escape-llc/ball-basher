import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { IGameController } from "./GameController";

export interface IGameStateListener {
	gameStateEvent(type: string, state: GameState): void
}
export class GameState {
	score = 0
	timeRemaining = 30
	round = 1
	scoreThisRound = 0
	forceMultiplier = 1
	spawnPoolSize = 10
	gravityMagnitude = 7
	extraBalls = 2
	gravityDirection = new Vector3(0, -0.7, -0.6)
	lastTime = performance.now();
	private igc: IGameController;
	private igs: IGameStateListener;
	constructor(igc: IGameController, igs: IGameStateListener) {
		this.igc = igc;
		this.igs = igs;
	}
	get currentGravity() {
		return new Vector3(this.gravityMagnitude * this.gravityDirection.x, this.gravityMagnitude * this.gravityDirection.y, this.gravityMagnitude * this.gravityDirection.z)
	}
	getDeltaTime() {
		const now = performance.now();
		const delta = (now - this.lastTime) / 1000; // Convert to seconds
		this.lastTime = now;
		return delta;
	}
	startGame() {
		this.lastTime = performance.now();
		this.igs.gameStateEvent("start", this);
	}
	isGameOver() {
		return this.extraBalls <= 0 && this.igc.activeBalls === 0;
	}
	nextRound() {
		if(this.scoreThisRound <= 0) {
			this.timeRemaining = 0;
			this.extraBalls = 0;
			this.igs.gameStateEvent("gameOver", this);
			return;
		}
		this.round++;
		this.scoreThisRound = 0;
		this.timeRemaining = 30;
		this.forceMultiplier *= 1.05;
		this.spawnPoolSize++;
		this.gravityMagnitude *= 0.95;
		this.gravityDirection.x += Math.random()*0.2 - 0.1;
		this.igs.gameStateEvent("nextRound", this);
	}
	scorePoints(points: number) {
		this.score += points;
		this.scoreThisRound += points;
		this.igs.gameStateEvent("scorePoints", this);
	}
	updateTimeRemaining(delta: number) {
		this.timeRemaining -= delta;
		if (this.timeRemaining <= 0) {
			this.nextRound();
		}
		else {
			this.igs.gameStateEvent("timeRemaining", this);
		}
	}
	adjustGravity(amount:Vector3) {
		this.gravityDirection.addInPlace(amount);
		this.igs.gameStateEvent("adjustGravity", this);
	}
	extraTime(amount: number) {
		this.timeRemaining += amount;
		this.igs.gameStateEvent("extraTime", this);
	}
}
