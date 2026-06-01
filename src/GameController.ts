import { GameState } from "./GameState";
import { GameObject, ControllableBall, PassiveBall } from "./GameObjects";
import type { Scene } from "@babylonjs/core";

export interface IGameController {
  startGame(): void;
  pauseGame(): void;
  resumeGame(): void;
  endGame(): void;
	spawnPassiveBall(): void;
	adjustGravity(): void;
	get activeBalls(): number;
	scene: Scene;
	state: GameState;
	controllableBalls: ControllableBall[];
	passiveBalls: PassiveBall[];
	cubes: GameObject[];
}