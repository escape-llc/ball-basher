import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
//import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
//import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import  { AdvancedDynamicTexture } from "@babylonjs/gui";
import {
	Color3, Color4, CubeTexture, FreeCamera, GlowLayer, HemisphericLight, Material, MeshBuilder, NodeMaterial, PBRMaterial, PhysicsAggregate, PhysicsMotionType, PhysicsShapeType,
	StandardMaterial, 
	Texture, 
	type IPhysicsCollisionEvent,
} from "@babylonjs/core";
import { setGuiTexture, UIManager } from "./UIManager";
import { GameState, type IGameStateListener } from "./GameState";
import { GameObject, ControllableBall, GameCube, PassiveBall } from "./GameObjects";
import type { IGameController } from "./GameController";
import crossFadeMaterial from "./assets/crossFadeMaterial.json";
import pbrCrossFadeMaterial from "./assets/pbrCrossFadeMaterial.json";
import { SpawnController } from "./SpawnController";
import tex_albedo from "./assets/albedo.png";
import tex_bump from "./assets/distortion.png";
import tex_studio from "./assets/studio.env?raw";
import { GamePanel } from "./Leaderboard";

declare const __VANILLA_VERSION__: string;

const canvas: HTMLElement|null = document.getElementById("renderCanvas");
const engine = new Engine(canvas as HTMLCanvasElement, true);
const uim = new UIManager();
const gamePanel = new GamePanel();

uim.version(__VANILLA_VERSION__);

class GameController implements IGameController, IGameStateListener {
	force_multiplier: number = 2
	scene: Scene
	state: GameState
	gameObjects: Map<string, GameObject> = new Map()
	controllableBalls: ControllableBall[] = []
	passiveBalls: PassiveBall[] = []
	cubes: GameCube[] = []
	gameStarted = false
	gameOver = false
	private havok: HavokPlugin
	private camera: FreeCamera
	private light: HemisphericLight
	private glow: GlowLayer
	private uim: UIManager
	private floorColor: Color3 = Color3.FromHSV(20, 0.75, 0.6)
	private floorMaterial: StandardMaterial|null = null
	private cubeMaterial: NodeMaterial|null = null
	private spawner: SpawnController
	private glowColor: Color3 = Color3.FromHSV(120, 0.7, 0.5)
	private passiveGlowColor: Color3 = Color3.FromHSV(240, 0.7, 0.5)
	constructor(scene: Scene, havok: HavokPlugin, glow: GlowLayer, uim: UIManager) {
		this.scene = scene
		this.state = new GameState(this, this)
		this.havok = havok
		this.glow = glow
		const camera = this.createCamera(scene)
		const light = new HemisphericLight("light", new Vector3(0, 1, -1), scene)
		this.camera = camera
		this.light = light
		this.uim = uim
		this.spawner = new SpawnController(this)
	}
	get activeBalls(): number {
		return this.controllableBalls.filter(ball => ball.mesh.isEnabled()).length
	}
	gameStateEvent(type: string, state: GameState): void {
		switch(type) {
			case "start":
				this.uim.round(state.round);
				this.uim.timeRemaining(state.timeRemaining);
				this.uim.score(state.score);
				this.uim.balls(state.extraBalls);
				this.uim.gravity(state.currentGravity);
				this.scene.getPhysicsEngine()?.setGravity(state.currentGravity);
				break;
			case "gameOver":
				this.uim.timeRemaining(state.timeRemaining);
				this.uim.balls(state.extraBalls);
				this.uim.gravity(state.currentGravity);
				this.controllableBalls.forEach(ball => ball.mesh.setEnabled(false));
				break;
			case "nextRound":
				this.uim.round(state.round);
				this.uim.timeRemaining(state.timeRemaining);
				this.uim.gravity(state.currentGravity);
				this.scene.getPhysicsEngine()?.setGravity(state.currentGravity);
				this.floorColor = Color3.FromHSV((state.round * 18) % 360, 0.75, 0.6);
//				if(this.floorMaterial) this.floorMaterial.diffuseColor = this.floorColor;
				break;
			case "scorePoints":
				this.uim.score(state.score);
				break;
			case "adjustGravity":
				this.uim.gravity(state.currentGravity);
				this.scene.getPhysicsEngine()?.setGravity(state.currentGravity);
				break;
			case "extraTime":
				this.uim.timeRemaining(state.timeRemaining);
				break;
			case "timeRemaining":
				this.uim.timeRemaining(state.timeRemaining);
				break;
		}
	}
	private createCamera(scene: Scene) {
		// Camera
		const camera = new FreeCamera("camera", new Vector3(0, 16, 6), scene);
		camera.setTarget(new Vector3(0, 0, 0));
		camera.rotation.z = Math.PI; // Rotate 180 degrees around Z axis
		return camera;
	}
	startGame(): void {
		this.gameStarted = true;
		this.gameOver = false;
		this.uim.startMessage(false);
		this.uim.gameOver(false);
		if(!this.scene) return;
		this.state = new GameState(this, this);
		this.state.startGame();
		this.controllableBalls.forEach(ball => {
			ball.respawn()
			// Convert the body into a live, moving object
			ball.body.body.setMotionType(PhysicsMotionType.DYNAMIC);
			// Wake up Havok's solver for this object
			const currentPosition = ball.body.transformNode.absolutePosition;
			const zeroImpulse = new Vector3(0, 0, 0);
			ball.body.body.applyImpulse(zeroImpulse, currentPosition);
		});
		this.passiveBalls.forEach(ball => ball.dispose())
		this.passiveBalls = []
		this.spawner.start()
//		this.floorColor = Color3.FromHSV((this.state.round * 18) % 360, 0.75, 0.6);
//		this.floorMaterial && (this.floorMaterial.diffuseColor = this.floorColor);
		gamePanel.displayPanel(false);
	}
	pauseGame(): void {
		throw new Error("Method not implemented.");
	}
	resumeGame(): void {
		throw new Error("Method not implemented.");
	}
	endGame(): void {
		gamePanel.displayPanel(true);
		gamePanel.submitScore(this.state.score)
		.then(() => {
			console.log("Score submitted successfully.");
		})
		.catch(err => {
			console.error("Error submitting score:", err);
		});
	}
	massFor(radius: number, density = 1): number {
		return (4/3) * Math.PI * Math.pow(radius, 3) * density;
	}
	spawnPassiveBall(): void {
		const radius = (Math.random() * 1.5 + 0.4)/2;
		const density = 2 + Math.random() * 20;
		const mass = this.massFor(radius, density)
		const ball = MeshBuilder.CreateSphere("passiveBall", { diameter: radius*2 }, this.scene);
		ball.position.set(0, 2, 0);
		const ballProps = {
			mass,
			restitution: Math.random() * 0.25 + 0.25,
			linearDamping: 0.2,
			angularDamping: 0.2,
			friction: Math.random() * 0.2 + 0.2
		}
		const material = new StandardMaterial("passiveMat", this.scene);
		material.diffuseColor = Color3.FromHSV(
			(density * 360) % 360,
			Math.min(1, Math.max(0.4, 0.5 + ballProps.restitution)),
			Math.min(1, Math.max(0.4, 0.6 + ballProps.friction))
		);
		ball.material = material;
		const body = new PhysicsAggregate(ball, PhysicsShapeType.SPHERE, ballProps, this.scene);
		body.body.setCollisionCallbackEnabled(true);
		body.body.getCollisionObservable().add(event => {
			//console.log("Collision detected", event);
			this.commonCollisionAction(event);
		});
		this.passiveBalls.push(new PassiveBall("passiveBall", ball, body, this));
	}
	private commonCollisionAction(event: IPhysicsCollisionEvent): void {
			if(event.type !== "COLLISION_STARTED") return
			const hitBody = event.collidedAgainst
			// Access the Mesh (TransformNode) linked to that body
			const hitMesh = hitBody.transformNode
			if(hitMesh.name === "floor" || hitMesh.name === "base") return
			// look up object
			let obj:GameObject|undefined = this.gameObjects.get(hitMesh.name)
			//console.log("hit: " + hitMesh.name, obj)
			if(!obj) {
				obj = this.passiveBalls.find(ball => ball.name === hitMesh.name);
			}
			if (!obj) return
			const go = obj as GameCube
			this.spawner.collision(go, event)
	}
	applyForce(force: Vector3): void {
		const fx = force.scale(this.state.forceMultiplier * this.force_multiplier);
		this.controllableBalls.forEach(ball => { if(!ball.isGlowing)ball.applyImpulse(fx); });
	}
	adjustGravity(): void {
		const gmx = (Math.random() - 0.5) * 2;
		const gmz = (Math.random() - 0.5) * 2;
		this.state.adjustGravity(new Vector3(gmx, 0, gmz));
	}
	startGameLoop(): void {
		this.scene.onBeforeActiveMeshesEvaluationObservable.add(() => {
			this.controllableBalls.forEach(ball => {
				if(!ball.isTouchingFloor()) {
					if(!ball.isGlowing) {
						console.log("Adding glow to ball", ball.name);
						ball.isGlowing = true;
						(ball.mesh.material as PBRMaterial).emissiveColor = this.glowColor;
						this.glow.addIncludedOnlyMesh(ball.mesh);
					}
				}
				else {
					if(ball.isGlowing) {
						console.log("Stopping glow to ball", ball.name);
						ball.isGlowing = false;
						(ball.mesh.material as PBRMaterial).emissiveColor = new Color3(0, 0, 0);
						this.glow.removeIncludedOnlyMesh(ball.mesh);
					}
				}
			});
			this.passiveBalls.forEach(ball => {
				if(!ball.isTouchingFloor()) {
					if(!ball.isGlowing) {
						ball.isGlowing = true;
						(ball.mesh.material as PBRMaterial).emissiveColor = this.passiveGlowColor;
						this.glow.addIncludedOnlyMesh(ball.mesh);
					}
				}
				else {
					if(ball.isGlowing) {
						ball.isGlowing = false;
						(ball.mesh.material as PBRMaterial).emissiveColor = new Color3(0, 0, 0);
						this.glow.removeIncludedOnlyMesh(ball.mesh);
					}
				}
			});
		});
		engine.runRenderLoop(() => {
			this.renderLoop();
		});
	}
	private async createCrossFadeMaterial(): Promise<NodeMaterial> {
		const mat = await NodeMaterial.Parse(crossFadeMaterial, this.scene);
		return mat;
	}
	private async createPbrCrossFadeMaterial(): Promise<NodeMaterial> {
		const mat = await NodeMaterial.Parse(pbrCrossFadeMaterial, this.scene);
		return mat;
	}
	async createGameObjects(): Promise<void> {
		const mat = await this.createPbrCrossFadeMaterial();
		console.log("Parsed material", mat);
		this.cubeMaterial = mat;
		this.createPlayArea();
		this.createCubes();
		this.createControllableBalls();
	}
	private pbrGroundMaterial(scene: Scene): PBRMaterial|null {
		// Ensure you have ambient light environment setup (PBR relies on this!)
		if (!scene.environmentTexture) {
				scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
						tex_studio, 
						scene
				);
		}

		// Create the Ground PBR Material
		const groundMat = new PBRMaterial("groundMaterial", scene);

		// Set the Core PBR Surface Properties
		groundMat.albedoColor = new Color3(0.6, 0.5, 0.4);  // Soft, natural earthy base tone
		groundMat.metallic = 0.0;                           // 0.0 = Natural/organic ground (Non-metallic)
		groundMat.roughness = 0.85;                         // 0.85 = Very rough, diffuses light nicely (soil/dirt)

		// (Optional) Simulate Puddles or Wet/Slick spots
		groundMat.clearCoat.isEnabled = true;
		groundMat.clearCoat.intensity = 0.3;                // Blends a thin, shiny layer on top
		groundMat.clearCoat.roughness = 0.1;                // Makes the wet layer highly reflective

		// Invert the Normal Map green channel if shading looks upside down
		groundMat.invertNormalMapX = false;
		groundMat.invertNormalMapY = true; 

		// Scale / Tile the textures so they look detailed over a large mesh
		// Create the texture instances directly
		const albedoTex = new Texture(tex_albedo, scene);
		const bumpTex = new Texture(tex_bump, scene);
		// Tile them here (TypeScript fully recognizes uScale/vScale on the Texture class)
		const tileAmount = 1.0;
		albedoTex.uScale = tileAmount;
		albedoTex.vScale = tileAmount;
		bumpTex.uScale = tileAmount;
		bumpTex.vScale = tileAmount;

		// Assign them to your PBR material slots
		groundMat.albedoTexture = albedoTex;
		groundMat.bumpTexture = bumpTex;
		return groundMat;
	}
	private createPlayArea(): void {
		// Floor
		const floor = MeshBuilder.CreateGround("floor", { width: 20, height: 10 }, this.scene);
		floor.position.y = 0;
//		this.floorMaterial = new StandardMaterial("floorMat", this.scene);
//		this.floorMaterial.diffuseColor = this.floorColor;
//		floor.material = this.floorMaterial;
		floor.material = this.pbrGroundMaterial(this.scene) ?? this.floorMaterial;
		const floorProps = {
			mass: 0,
			restitution: 0.1,
			friction: 0.2,
		};
		const groundAggregate = new PhysicsAggregate(floor, PhysicsShapeType.BOX, floorProps, this.scene);

		// Base
		const base = MeshBuilder.CreateBox("base", { width: 22, height: 1, depth: 1 }, this.scene);
		base.position.set(0, 0.5, -5.5);
//		const baseMaterial = new StandardMaterial("baseMat", this.scene);
//		baseMaterial.diffuseColor = new Color3(0, 1, 0.5);
//		base.material = baseMaterial;
		base.material = floor.material;
		const baseProps = { mass: 0, restitution: 0.9 };
		const baseAggregate = new PhysicsAggregate(base, PhysicsShapeType.BOX, baseProps, this.scene);
	}
	private createCubeMaterial(name: string, neutral: Color3): Material {
		if(this.cubeMaterial) {
			const  mx: NodeMaterial = this.cubeMaterial.clone(name + "-Mat");
			return mx;
		}
		else {
			const material = new StandardMaterial(name + "-Mat", this.scene);
			material.diffuseColor = neutral;
			return material;
		}
	}
	private createCubes() {
		// Left side: 10 cubes
		const cubeProps = { mass: 0 };
		const neutral = new Color3(0.5, 0.5, 0.5)
		for (let ix = 0; ix < 10; ix++) {
			const name = `cube-left-${ix}`;
			const cube = MeshBuilder.CreateBox(name, { size: 1 }, this.scene);
			cube.position.set(-10.5, 0.5, -4.5 + ix);
			cube.material = this.createCubeMaterial(name, neutral);
			const cubeBody = new PhysicsAggregate(cube, PhysicsShapeType.BOX, cubeProps, this.scene);
			cubeBody.body.setMotionType(PhysicsMotionType.ANIMATED);
			cubeBody.body.disablePreStep = false;
			const go = new GameCube(name, cube, cubeBody, this);
			this.gameObjects.set(name, go)
			this.cubes.push(go);
		}
		// Right side: 10 cubes
		for (let ix = 0; ix < 10; ix++) {
			const name = `cube-right-${ix}`;
			const cube = MeshBuilder.CreateBox(name, { size: 1 }, this.scene);
			cube.position.set(10.5, 0.5, -4.5 + ix);
			cube.material = this.createCubeMaterial(name, neutral);
			const cubeBody = new PhysicsAggregate(cube, PhysicsShapeType.BOX, cubeProps, this.scene);
			cubeBody.body.setMotionType(PhysicsMotionType.ANIMATED);
			cubeBody.body.disablePreStep = false;
			const go = new GameCube(name, cube, cubeBody, this);
			this.gameObjects.set(name, go);
			this.cubes.push(go);
		}
		// Top side: 22 cubes
		for (let ix = 0; ix < 22; ix++) {
			const name = `cube-top-${ix}`;
			const cube = MeshBuilder.CreateBox(name, { size: 1 }, this.scene);
			cube.position.set(-10.5 + ix, 0.5, 5.5);
			cube.material = this.createCubeMaterial(name, neutral);
			const cubeBody = new PhysicsAggregate(cube, PhysicsShapeType.BOX, cubeProps, this.scene);
			cubeBody.body.setMotionType(PhysicsMotionType.ANIMATED);
			// TODO only enable this while animating
			cubeBody.body.disablePreStep = false;
			const go = new GameCube(name, cube, cubeBody, this);
			this.gameObjects.set(name, go);
			this.cubes.push(go);
		}
	}
	private createControllableBalls(): void {
		const hue = [10, 180, 280];
		const diameters = [0.9, 0.7, 0.5];
		const masses = [13, 9, 7];
		const restitution = [0.35, 0.6, 0.3];
		const friction = [0.1, 0.3, 0.4];
		const linearDamping = [0.15, 0.3, 0.5];
		for (let ix = 0; ix < 3; ix++) {
			const name = "ball" + ix
			const ball = MeshBuilder.CreateSphere(name, { diameter: diameters[ix] }, this.scene);
			const spawn = new Vector3(ix, 2, 0);
			ball.position.set(ix, 2, 0);
			const material = new PBRMaterial("Mat-" + name, this.scene);
			material.metallic = 0.7;
			material.roughness = 0.2;
			material.albedoColor = Color3.FromHSV(hue[ix], 0.85, 0.7);
			ball.material = material;
			const ballProps = {
				mass: masses[ix],
				restitution: restitution[ix],
				linearDamping: linearDamping[ix],
				angularDamping: 0.2,
				friction: friction[ix]
			};
			const body = new PhysicsAggregate(ball, PhysicsShapeType.SPHERE, ballProps, this.scene);
			body.body.setCollisionCallbackEnabled(true);
			body.body.getCollisionObservable().add(event => {
				this.commonCollisionAction(event);
			});
			const go = new ControllableBall(name, ball, body, this)
			go.spawnPosition = spawn;
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
		const forceVector = getForceVector();
		this.applyForce(forceVector);

		//		this.cubes.forEach(cube => cube.update(deltaTime));
		this.spawner.update(deltaTime)
		this.state.updateTimeRemaining(deltaTime);

		// Check if balls are out
		this.controllableBalls.forEach(ball => {
			if (ball.mesh.position.y < -2 || Math.abs(ball.mesh.position.x) > 13 || Math.abs(ball.mesh.position.z) > 7) {
				if (this.state.extraBalls > 0) {
					this.state.extraBalls--;
					ball.respawn();
					this.uim.balls(this.state.extraBalls);
				} else {
					ball.setEnabled(false);
//					ball.dispose();
				}
			}
		});
		this.passiveBalls = this.passiveBalls.filter(ball => {
			if (ball.mesh.position.y < -2 || Math.abs(ball.mesh.position.x) > 13 || Math.abs(ball.mesh.position.z) > 7) {
				ball.dispose();
				return false;
			}
			return true;
		});
		this.scene?.render();
		if(this.state.isGameOver()) {
			this.gameOver = true;
			this.uim.gameOver(true);
			this.endGame();
		}
	}
	private static createScene(physicsPlugin: HavokPlugin) {
		// Create scene
		const scene = new Scene(engine);
		scene.clearColor = new Color4(0, 0, 0, 1);

		// Enable physics
		scene.enablePhysics(new Vector3(0, 0, 0), physicsPlugin);
		return scene;
	}
	static async initialize(): Promise<GameController> {
		const havok = await HavokPhysics();
		const havokPlugin = new HavokPlugin(true, havok);
		const scene = GameController.createScene(havokPlugin);
		setGuiTexture(AdvancedDynamicTexture.CreateFullscreenUI("UI"));
		scene.createDefaultEnvironment({ createSkybox: false, createGround: false });
		const glowLayer = new GlowLayer("glowLayer", scene);
		const gc = new GameController(scene, havokPlugin, glowLayer, uim);
		await gc.createGameObjects();
		return gc;
	}
}

const game: GameController = await GameController.initialize();

// Input
const forceVector = new Vector3(0, 0, 0)
const keys: Record<string, boolean> = {}

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
gamePanel.refreshLeaderboard();

// Apply force to controllable balls
function getForceVector() {
	// Simple input handling
	forceVector.x = 0;
	forceVector.y = 0;
	forceVector.z = 0;
	if (keys.ArrowLeft || keys.KeyA) forceVector.x = -1;
	if (keys.ArrowRight || keys.KeyD) forceVector.x = 1;
	if (keys.ArrowUp || keys.KeyW) forceVector.z = 1;
	if (keys.ArrowDown || keys.KeyS) forceVector.z = -1;
//	if (forceVector.length() < 0.01) return; // Dead zone
	return forceVector;
}
