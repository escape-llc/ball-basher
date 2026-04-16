import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
//import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
//import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import  { AdvancedDynamicTexture } from "@babylonjs/gui";
import {
	Color3, Color4, FreeCamera, HemisphericLight, MeshBuilder, PhysicsAggregate, PhysicsMotionType, PhysicsShapeType,
	StandardMaterial, 
	type IPhysicsCollisionEvent,
} from "@babylonjs/core";
import { setGuiTexture, UIManager } from "./UIManager";
import { GameState } from "./GameState";
import { GameObject, ControllableBall, GameCube, PassiveBall } from "./GameObjects";
import type { IGameController } from "./GameController";
declare const __VANILLA_VERSION__: string;

const canvas: HTMLElement|null = document.getElementById("renderCanvas");
const engine = new Engine(canvas as HTMLCanvasElement, true);
const uim = new UIManager();

uim.version(__VANILLA_VERSION__);

class GameController implements IGameController {
	scene: Scene
	state: GameState
	gameObjects: Map<string, GameObject> = new Map()
	controllableBalls: ControllableBall[] = []
	passiveBalls: PassiveBall[] = []
	cubes: GameCube[] = []
	spawnSequence: string[] = [
		"Multiplier=1", "Multiplier=2", "Hole", "Multiplier=4", "Multiplier=-1",
		"Multiplier=8", "Multiplier=-2", "Hole", "Multiplier=16", "Multiplier=-4",
		"Multiplier=32", "Multiplier=-8", "Hole", "Multiplier=-16", "Multiplier=-32",
		"Passive Ball", "Gravity Adjust", "Hole", "Extra Time", "Passive Ball", "Extra Ball",
		"Hole", "Multiplier=16", "Gravity Adjust", "Multiplier=-16", "Extra Time",
		"Hole", "Multiplier=32", "Gravity Adjust", "Multiplier=-32", "Extra Time"
	]
	gameStarted = false
	gameOver = false
	private havok: HavokPlugin
	private camera: FreeCamera
	private light: HemisphericLight
	private uim: UIManager
	constructor(scene: Scene, havok: HavokPlugin, uim: UIManager) {
		this.scene = scene;
		this.state = new GameState(uim, this);
		this.havok = havok;
		const camera = createCamera(scene);
		const light = new HemisphericLight("light", new Vector3(0, 1, -1), scene);
		this.camera = camera;
		this.light = light;
		this.uim = uim;
	}
	startGame(): void {
		this.gameStarted = true;
		this.gameOver = false;
		this.uim.startMessage(false);
		this.uim.gameOver(false);
		if(!this.scene) return;
		this.state = new GameState(this.uim, this);
		this.state.startGame();
	}
	pauseGame(): void {
		throw new Error("Method not implemented.");
	}
	resumeGame(): void {
		throw new Error("Method not implemented.");
	}
	endGame(): void {
		throw new Error("Method not implemented.");
	}
	spawnPassiveBall(): void {
		const ball = MeshBuilder.CreateSphere("passiveBall", { diameter: Math.random() * 0.5 + 0.4 }, this.scene);
		ball.position.set(0, 2, 0);
		const material = new StandardMaterial("passiveMat", this.scene);
		material.diffuseColor = Color3.FromHSV(Math.random() * 360, 0.8, 0.6);
		ball.material = material;
		const ballProps = { mass: Math.random() * 0.5 + 0.1, restitution: 0.5, linearDamping: 0.2, angularDamping: 0.2, friction: 0.2 }
		const body = new PhysicsAggregate(ball, PhysicsShapeType.SPHERE, ballProps, this.scene);
		body.body.setCollisionCallbackEnabled(true);
		body.body.getCollisionObservable().add(event => {
			//console.log("Collision detected", event);
			this.commonCollisionAction(event);
		});
		this.passiveBalls.push(new PassiveBall("passiveBall", ball, body, this));
	}
	private commonCollisionAction(event: IPhysicsCollisionEvent): void {
			if(event.type !== "COLLISION_STARTED") return;
			const hitBody = event.collidedAgainst;
			// Access the Mesh (TransformNode) linked to that body
			const hitMesh = hitBody.transformNode;
			if(hitMesh.name === "floor" || hitMesh.name === "base") return;
			// look up object
			const obj:GameObject|undefined = this.gameObjects.get(hitMesh.name);
			if (!obj) return;
			if(!("collisionAction" in obj)) return;
			const go = obj as GameCube;
			//const spawnType = go.spawnType;
			//console.log("hit: " + hitMesh.name, spawnType);
			go.collisionAction(event);
	}
	applyForce(force: Vector3): void {
		const fx = force.scale(this.state.forceMultiplier * 2);
		this.controllableBalls.forEach(ball => { ball.applyImpulse(fx); });
	}
	adjustGravity(): void {
		const gmx = (Math.random() - 0.5) * 2;
		const gmz = (Math.random() - 0.5) * 2;
		this.state?.adjustGravity(new Vector3(gmx, 0, gmz));
	}
	startGameLoop(): void {
		engine.runRenderLoop(() => {
			this.scene && this.renderLoop();
		});
	}
	createGameObjects(): void {
		this.createPlayArea();
		this.createCubes(this.scene);
		this.createControllableBalls(this.scene);
	}
	private createPlayArea(): void {
		// Floor
		const floor = MeshBuilder.CreateGround("floor", { width: 20, height: 10 }, this.scene);
		floor.position.y = 0;
		const floorMaterial = new StandardMaterial("floorMat", this.scene);
		floorMaterial.diffuseColor = new Color3(0.95, 0.65, 0.5);
		floor.material = floorMaterial;
		const floorProps = {
			mass: 0,
			restitution: 0.1,
			friction: 0.2,
		};
		const groundAggregate = new PhysicsAggregate(floor, PhysicsShapeType.BOX, floorProps, this.scene);

		// Base
		const base = MeshBuilder.CreateBox("base", { width: 22, height: 1, depth: 1 }, this.scene);
		base.position.set(0, 0.5, -5.5);
		const baseMaterial = new StandardMaterial("baseMat", this.scene);
		baseMaterial.diffuseColor = new Color3(0, 1, 0.5);
		base.material = baseMaterial;
		const baseProps = { mass: 0, restitution: 0.9 };
		const baseAggregate = new PhysicsAggregate(base, PhysicsShapeType.BOX, baseProps, this.scene);
	}
	private createCubes(scene: Scene) {
		// Left side: 10 cubes
		const cubeProps = { mass: 0 };
		for (let ix = 0; ix < 10; ix++) {
			const name = `cube-left-${ix}`;
			const cube = MeshBuilder.CreateBox(name, { size: 1 }, scene);
			cube.position.set(-10.5, 0.5, -4.5 + ix);
			const material = new StandardMaterial(`cubeMat-left-${ix}`, scene);
			material.diffuseColor = new Color3(0.5, 0.5, 0.5);
			cube.material = material;
			const cubeBody = new PhysicsAggregate(cube, PhysicsShapeType.BOX, cubeProps, scene);
			cubeBody.body.setMotionType(PhysicsMotionType.ANIMATED);
			cubeBody.body.disablePreStep = false;
			const go = new GameCube(name, cube, cubeBody, this, "Inert", Math.random()*2, false);
			this.gameObjects.set(name, go)
			this.cubes.push(go);
		}
		// Right side: 10 cubes
		for (let ix = 0; ix < 10; ix++) {
			const name = `cube-right-${ix}`;
			const cube = MeshBuilder.CreateBox(name, { size: 1 }, scene);
			cube.position.set(10.5, 0.5, -4.5 + ix);
			const material = new StandardMaterial(`cubeMat-right-${ix}`, scene);
			material.diffuseColor = new Color3(0.5, 0.5, 0.5);
			cube.material = material;
			const cubeBody = new PhysicsAggregate(cube, PhysicsShapeType.BOX, cubeProps, scene);
			cubeBody.body.setMotionType(PhysicsMotionType.ANIMATED);
			cubeBody.body.disablePreStep = false;
			const go = new GameCube(name, cube, cubeBody, this, "Inert", Math.random()*2, false);
			this.gameObjects.set(name, go);
			this.cubes.push(go);
		}
		// Top side: 22 cubes
		for (let ix = 0; ix < 22; ix++) {
			const name = `cube-top-${ix}`;
			const cube = MeshBuilder.CreateBox(name, { size: 1 }, scene);
			cube.position.set(-10.5 + ix, 0.5, 5.5);
			const material = new StandardMaterial(`cubeMat-top-${ix}`, scene);
			material.diffuseColor = new Color3(0.5, 0.5, 0.5);
			cube.material = material;
			const cubeBody = new PhysicsAggregate(cube, PhysicsShapeType.BOX, cubeProps, scene);
			cubeBody.body.setMotionType(PhysicsMotionType.ANIMATED);
			// TODO only enable this while animating
			cubeBody.body.disablePreStep = false;
			const go = new GameCube(name, cube, cubeBody, this, "Inert", Math.random()*2, false);
			this.gameObjects.set(name, go);
			this.cubes.push(go);
		}
	}
	private createControllableBalls(scene: Scene) {
		const hue = [10, 180, 280];
		const diameters = [0.9, 0.7, 0.5];
		const masses = [14, 9, 7];
		const restitution = [0.3, 0.6, 0.3];
		const friction = [0.2, 0.3, 0.4];
		const linearDamping = [0.2, 0.3, 0.5];
		for (let ix = 0; ix < 3; ix++) {
			const name = "ball" + ix
			const ball = MeshBuilder.CreateSphere(name, { diameter: diameters[ix] }, scene);
			ball.position.set(ix, 2, 0);
			const material = new StandardMaterial("Mat-" + name, scene);
			material.diffuseColor = Color3.FromHSV(hue[ix], 0.7, 0.6);
	//		material.emissiveColor = new Color3(0.3, 0.3, 0.3);
			ball.material = material;
			const ballProps = {
				mass: masses[ix], restitution: restitution[ix], linearDamping: linearDamping[ix], angularDamping: 0.2, friction: friction[ix]
			};
			const body = new PhysicsAggregate(ball, PhysicsShapeType.SPHERE, ballProps, scene);
			body.body.setCollisionCallbackEnabled(true);
			body.body.getCollisionObservable().add(event => {
				//console.log("Collision detected", event);
				this.commonCollisionAction(event);
			});
			const go = new ControllableBall(name, ball, body, this)
			this.gameObjects.set(name, go)
			this.controllableBalls.push(go);
		}
	}
	private renderLoop(): void {
		if (!this.gameStarted || this.gameOver) {
			this.scene?.render();
			return;
		}
		const deltaTime = this.state.getDeltaTime() ?? 0;
		applyForce();
		this.cubes.forEach(cube => cube.update(deltaTime));
		this.state.updateTimeRemaining(deltaTime);

		// Check if balls are out
		this.controllableBalls = this.controllableBalls.filter(ball => {
			if (ball.mesh.position.y < -2 || Math.abs(ball.mesh.position.x) > 12 || Math.abs(ball.mesh.position.z) > 6) {
				if (this.state.extraBalls > 0) {
					this.state.extraBalls--;
					ball.mesh.position.set(0, 2, 0);
					const body = ball.body.body;
					body.setLinearVelocity(Vector3.Zero());
					return true;
				} else {
					ball.dispose();
					return false;
				}
			}
			return true;
		});
		this.passiveBalls = this.passiveBalls.filter(ball => {
			if (ball.mesh.position.y < -2 || Math.abs(ball.mesh.position.x) > 12 || Math.abs(ball.mesh.position.z) > 6) {
				ball.dispose();
				return false;
			}
			return true;
		});
		this.uim.balls(this.controllableBalls.length + this.state.extraBalls);
		this.scene?.render();
		if(this.state.isGameOver()) {
			this.gameOver = true;
			this.uim.gameOver(true);
		}
	}
	static async initialize(): Promise<GameController> {
		const havok = await HavokPhysics();
		const havokPlugin = new HavokPlugin(true, havok);
		const scene = createScene(havokPlugin);
		setGuiTexture(AdvancedDynamicTexture.CreateFullscreenUI("UI"));
//		const camera = createCamera(scene);
//		const light = new HemisphericLight("light", new Vector3(0, 1, -1), scene);
		const gc = new GameController(scene, havokPlugin, uim);
		gc.createGameObjects();
		return gc;
	}
}

let game: GameController = await GameController.initialize();

// Input
let forceVector = new Vector3(0, 0, 0)
let keys: Record<string, boolean> = {}

// Event listeners
window.addEventListener("keydown", (e) => {
	keys[e.code] = true;
	if (e.code === 'Space' && !game.gameStarted) {
		game.startGame();
	}
	else if(e.code === 'Space' && game.gameOver) {
		uim.gameOver(false);
		game.gameStarted = false;
		game.gameOver = false;
		uim.startMessage(true);
	}
})
window.addEventListener("keyup", (e) => { keys[e.code] = false; })

// Resize
window.addEventListener("resize", () => {
	engine.resize();
})

game.startGameLoop();

function createScene(physicsPlugin: HavokPlugin) {
	// Create scene
	const scene = new Scene(engine);
	scene.clearColor = new Color4(0, 0, 0, 1);

	// Enable physics
	scene.enablePhysics(new Vector3(0, 0, 0), physicsPlugin);
	return scene;
}
function createCamera(scene: Scene) {
	// Camera
	const camera = new FreeCamera("camera", new Vector3(0, 16, 6), scene);
	camera.setTarget(new Vector3(0, 0, 0));
	camera.rotation.z = Math.PI; // Rotate 180 degrees around Z axis
	return camera;
}
// Apply force to controllable balls
function applyForce() {
	// Simple input handling
	forceVector.x = 0;
	forceVector.y = 0;
	forceVector.z = 0;
	if (keys.ArrowLeft || keys.KeyA) forceVector.x = -1;
	if (keys.ArrowRight || keys.KeyD) forceVector.x = 1;
	if (keys.ArrowUp || keys.KeyW) forceVector.z = 1;
	if (keys.ArrowDown || keys.KeyS) forceVector.z = -1;
//	if (forceVector.length() < 0.01) return; // Dead zone
	game.applyForce(forceVector);
}
