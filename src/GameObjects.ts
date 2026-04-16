import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
	Color3, PhysicsAggregate, StandardMaterial, Animation,
	type Mesh, type IPhysicsCollisionEvent,
} from "@babylonjs/core";
import type { IGameController } from "./GameController";
import { createScoreLabel } from "./UIManager";

/**
 * @param {BABYLON.Mesh} mesh - The visual mesh linked to the body
 * @param {BABYLON.Mesh} mesh - The visual mesh linked to the body
 * @param {number} delayMs - Wait time at the bottom in milliseconds
 */
function animateHole(mesh: Mesh, delayMs: number) {
	const frameRate = 30;
	const startY = mesh.position.y;
	
	// Animation: Move down 2 units
	const moveDown = new Animation("down", "position.y", frameRate, Animation.ANIMATIONTYPE_FLOAT);
	moveDown.setKeys([{frame: 0, value: startY}, {frame: frameRate, value: startY - 2}]);

	// Animation: Move up 2 units
	const moveUp = new Animation("up", "position.y", frameRate, Animation.ANIMATIONTYPE_FLOAT);
	moveUp.setKeys([{frame: 0, value: startY - 2}, {frame: frameRate, value: startY}]);

	return new Promise(resolve => {
		// Execute sequence
		mesh.getScene().beginDirectAnimation(mesh, [moveDown], 0, frameRate, false, 1.0, () => {
			// Wait for the caller's specific delay
			setTimeout(() => {
				mesh.getScene().beginDirectAnimation(mesh, [moveUp], 0, frameRate, false, 1.0, () => {
					resolve(mesh);
				});
			}, delayMs);
		});
	});
}

export class GameObject {
	readonly name: string
	readonly mesh: Mesh
	readonly body: PhysicsAggregate
	protected disposed: boolean = false
	protected igc: IGameController
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		this.name = name;
		this.mesh = mesh;
		this.body = body;
		this.igc = igc;
	}
	dispose() {
		if(this.disposed) return;
		this.mesh.dispose();
		this.body.dispose();
		this.disposed = true;
	}
	setEnabled(enabled: boolean) {
		if(this.disposed) return;
		this.mesh.setEnabled(enabled);
	}
}
export class ControllableBall extends GameObject {
	spawnPosition: Vector3 = new Vector3(0, 2, 0);
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		super(name, mesh, body, igc);
	}
	applyImpulse(forceVector: Vector3) {
		this.body.body.applyImpulse(forceVector, this.mesh.getAbsolutePosition());
	}
	respawn() {
		this.setEnabled(false);
		this.body.body.disablePreStep = true;
		this.body.body.setLinearVelocity(Vector3.Zero());
		this.mesh.position.copyFrom(this.spawnPosition);
		this.setEnabled(true);
		this.body.body.disablePreStep = false;
	}
}
export class PassiveBall extends GameObject {
	spawnPosition: Vector3 = new Vector3(0, 2, 0);
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		super(name, mesh, body, igc);
	}
}
export class GameCube extends GameObject {
	spawnType: string
	spawnTimer: number
	isAnimating: boolean
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController, spawnType: string, spawnTimer: number, isAnimating: boolean) {
		super(name, mesh, body, igc);
		this.spawnType = spawnType;
		this.spawnTimer = spawnTimer;
		this.isAnimating = isAnimating;
	}
	update(delay: number) {
		this.spawnTimer -= delay;
		if (this.spawnTimer <= 0) {
			// Select new spawn type
			const index = Math.floor(Math.random() * Math.min(this.igc.state.spawnPoolSize, this.igc.spawnSequence.length));
			this.spawnType = this.igc.spawnSequence[index];
			// Set duration
			let duration;
			switch (this.spawnType) {
				case "Inert": duration = Math.random() * 4 + 3; break;
				case "Hole": duration = Math.random() * 5 + 5; break;
				default:
					if (this.spawnType.startsWith("Multiplier")) duration = Math.random() * 5 + 5;
					else duration = Math.random() * 7 + 3;
					break;
			}
			this.spawnTimer = duration;
			this.updateAppearance();
		}
	}
	updateAppearance() {
		if(this.isAnimating) return; // Don't change appearance while animating
		const material = this.mesh.material;
		if(!material || !(material instanceof StandardMaterial)) return;
		switch (this.spawnType) {
			case "Inert":
				material.diffuseColor = new Color3(0.5, 0.5, 0.5);
				break;
			case "Hole":
				if(!this.isAnimating) {
					material.diffuseColor = new Color3(0.25, 0.25, 0.25);
					this.isAnimating = true;
					animateHole(this.mesh, this.spawnTimer * 1000).then(() => {
						this.isAnimating = false;
						this.spawnType = "Inert";
						this.spawnTimer = 1;
						material.diffuseColor = new Color3(0.5, 0.5, 0.5);
					});
				}
				break;
			default:
				if (this.spawnType.startsWith("Multiplier")) {
					const mult = parseInt(this.spawnType.split("=")[1]);
					const hue = mult > 0 ? 240 - (mult / 32) * 120 : 0 + (Math.abs(mult) / 32) * 120;
					material.diffuseColor = Color3.FromHSV(hue, 0.8, 0.6);
				} else {
					// Power ups, simple colors
					if (this.spawnType === "Passive Ball") material.diffuseColor = new Color3(1, 1, 0);
					else if (this.spawnType === "Gravity Adjust") material.diffuseColor = new Color3(0, 1, 1);
					else if (this.spawnType === "Extra Time") material.diffuseColor = new Color3(1, 0, 1);
					else if (this.spawnType === "Extra Ball") material.diffuseColor = new Color3(0, 1, 0);
				}
				break;
		}
	}
	collisionAction(event: IPhysicsCollisionEvent) {
		if(!this.spawnType) return;
		if (this.spawnType.startsWith("Multiplier")) {
			const mult = parseInt(this.spawnType.split("=")[1]);
			const force = event.impulse;
			const points = Math.round(force * mult);
			this.igc.state.scorePoints(points);
			event.point && createScoreLabel(points.toString(), event.point.clone(), 1000);
		} else if (this.spawnType === "Passive Ball") {
			this.igc.spawnPassiveBall();
			// Reset cube to inert
			this.spawnType = "Inert";
			this.spawnTimer = 2 + Math.random()*3;
		} else if (this.spawnType === "Gravity Adjust") {
			this.igc.adjustGravity();
			// Reset cube to inert
			this.spawnType = "Inert";
				this.spawnTimer = 2 + Math.random()*3;
		} else if (this.spawnType === "Extra Time") {
			this.igc.state.extraTime(Math.random() * 3 + 3);
			// Reset cube to inert
			this.spawnType = "Inert";
			this.spawnTimer = 2 + Math.random()*3;
		} else if (this.spawnType === "Extra Ball") {
			this.igc.state.extraBalls++;
			// Reset cube to inert
			this.spawnType = "Inert";
			this.spawnTimer = 2 + Math.random()*3;
		}
	}
}
