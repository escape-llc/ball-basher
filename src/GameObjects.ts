import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
	PhysicsAggregate, Animation,
	type Mesh,
	Material,
} from "@babylonjs/core";
import type { IGameController } from "./GameController";

/**
 * @param {BABYLON.Mesh} mesh - The visual mesh linked to the body
 * @param {BABYLON.Mesh} mesh - The visual mesh linked to the body
 * @param {number} delayMs - Wait time at the bottom in milliseconds
 */
export function animateHole(mesh: Mesh, delayMs: number) {
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
	get material(): Material|null {
		if(this.disposed) return null
		return this.mesh.material
	}
	set material(mat: Material|null) {
		if(this.disposed) return
		this.mesh.material = mat
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
export class BallCommon extends GameObject {
	spawnPosition: Vector3 = new Vector3(0, 2, 0);
	worldRadius: number
	isGlowing: boolean = false
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		super(name, mesh, body, igc);
    const boundInfo = mesh.getBoundingInfo();
    const localRadius = (boundInfo.maximum.y - boundInfo.minimum.y) / 2;
    this.worldRadius = localRadius * mesh.scaling.y;
		//console.log(`world radius ${name}: ${this.worldRadius}`);
	}
	applyImpulse(forceVector: Vector3) {
		this.body.body.applyImpulse(forceVector, this.mesh.getAbsolutePosition());
	}
	isTouchingFloor(): boolean {
		const currentY = this.mesh.getAbsolutePosition().y;
		const deltaY = Math.abs(currentY - this.worldRadius);
		//console.log(`${this.name} deltaY: ${deltaY} center: ${currentY} radius: ${this.worldRadius}`);
		return deltaY <= 0.15; // floor is at y=0
	}
}
export class ControllableBall extends BallCommon {
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		super(name, mesh, body, igc);
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
export class PassiveBall extends BallCommon {
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		super(name, mesh, body, igc);
	}
}
export class GameCube extends GameObject {
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, igc: IGameController) {
		super(name, mesh, body, igc);
	}
}
