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
	scene: Scene;
	state: GameState;
	spawnSequence: string[];
	controllableBalls: ControllableBall[];
	passiveBalls: PassiveBall[];
	cubes: GameObject[];
}