import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import  { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import {
	Color3, Color4, FreeCamera, HemisphericLight, MeshBuilder, PhysicsAggregate, PhysicsMotionType, PhysicsShapeType,
	StandardMaterial, TransformNode, Animation,
	type Mesh,
} from "@babylonjs/core";
declare const __VANILLA_VERSION__: string;

const canvas: HTMLElement|null = document.getElementById("renderCanvas");
const engine = new Engine(canvas as HTMLCanvasElement, true);
// UI elements
const scoreElement: HTMLElement|null = document.getElementById("score");
const timeElement: HTMLElement|null = document.getElementById("time");
const roundElement: HTMLElement|null = document.getElementById("round");
const ballsElement: HTMLElement|null = document.getElementById("balls");
const startElement: HTMLElement|null = document.getElementById("startMessage")
const gameOverElement: HTMLElement|null = document.getElementById("gameOver");
const versionElement: HTMLElement|null = document.getElementById("version");

versionElement && (versionElement.textContent = __VANILLA_VERSION__);

class GameState {
	score = 0
	timeRemaining = 30
	round = 1
	forceMultiplier = 1
	spawnPoolSize = 10
	gravityMagnitude = 7
	extraBalls = 2
	gravityDirection = new Vector3(0, -0.781, -0.625)
	lastTime = performance.now();
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
		scene?.getPhysicsEngine()?.setGravity(gameState.currentGravity);
		roundElement && (roundElement.textContent = this.round.toString());
		timeElement && (timeElement.textContent = Math.ceil(this.timeRemaining).toString());
		scoreElement && (scoreElement.textContent = this.score.toString());
	}
	isGameOver() {
		return gameState.extraBalls <= 0 && controllableBalls.length === 0;
	}
	nextRound() {
		this.round++;
		roundElement && (roundElement.textContent = this.round.toString());
		this.timeRemaining = 30;
		this.forceMultiplier *= 1.01;
		this.spawnPoolSize++;
		this.gravityMagnitude *= 1.01;
		timeElement && (timeElement.textContent = Math.ceil(this.timeRemaining).toString());
		scene?.getPhysicsEngine()?.setGravity(this.currentGravity);
	}
	scorePoints(points: number) {
		this.score += points;
		scoreElement && (scoreElement.textContent = this.score.toString());
	}
	updateTimeRemaining(delta: number) {
		this.timeRemaining -= delta;
		timeElement && (timeElement.textContent = Math.ceil(this.timeRemaining).toString());
		if (this.timeRemaining <= 0) {
			this.nextRound();
		}
	}
	adjustGravity(amount:Vector3) {
		this.gravityDirection.addInPlace(amount);
		scene?.getPhysicsEngine()?.setGravity(this.currentGravity);
	}
	extraTime(amount: number) {
		this.timeRemaining += amount;
		timeElement && (timeElement.textContent = Math.ceil(this.timeRemaining).toString());
	}
}
class GameObject {
	name: string
	mesh: Mesh
	body: PhysicsAggregate
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate) {
		this.name = name;
		this.mesh = mesh;
		this.body = body;
	}
}
class ControllableBall extends GameObject {
}
class PassiveBall extends GameObject {
}
class GameCube extends GameObject {
	spawnType: string
	spawnTimer: number
	isAnimating: boolean
	constructor(name: string, mesh: Mesh, body: PhysicsAggregate, spawnType: string, spawnTimer: number, isAnimating: boolean) {
		super(name, mesh, body);
		this.spawnType = spawnType;
		this.spawnTimer = spawnTimer;
		this.isAnimating = isAnimating;
	}
	update(delay: number) {
		this.spawnTimer -= delay;
		if (this.spawnTimer <= 0) {
			// Select new spawn type
			const index = Math.floor(Math.random() * Math.min(gameState.spawnPoolSize, spawnSequence.length));
			this.spawnType = spawnSequence[index];
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
}
let gameObjects: Map<string, GameObject> = new Map();
// Game variables
let scene: Scene|undefined = undefined;
let controllableBalls: Mesh[] = [];
let passiveBalls: Mesh[] = [];
let cubes: GameCube[] = [];
let gameStarted = false;
let gameOver = false;
let gameState = new GameState();
let spawnSequence = [
	"Multiplier=1", "Multiplier=2", "Hole", "Multiplier=4", "Multiplier=-1",
	"Multiplier=8", "Multiplier=-2", "Hole", "Multiplier=16", "Multiplier=-4",
	"Multiplier=32", "Multiplier=-8", "Hole", "Multiplier=-16", "Multiplier=-32",
	"Passive Ball", "Gravity Adjust", "Hole", "Extra Time", "Passive Ball", "Extra Ball",
	"Hole", "Multiplier=16", "Gravity Adjust", "Multiplier=-16", "Extra Time",
	"Hole", "Multiplier=32", "Gravity Adjust", "Multiplier=-32", "Extra Time"
];

// Input
let forceVector = new Vector3(0, 0, 0);
let keys: Record<string, boolean> = {};

// Event listeners
window.addEventListener("keydown", (e) => {
	keys[e.code] = true;
	if (e.code === 'Space' && !gameStarted) {
		startGame();
	}
	else if(e.code === 'Space' && gameOver) {
		gameOverElement && (gameOverElement.style.display = "none");
		gameStarted = false;
		startElement && (startElement.style.display = "block");
	}
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// Resize
window.addEventListener("resize", () => {
	engine.resize();
});

// before initializing your babylon scene:
let havokInstance;
let guiTexture: AdvancedDynamicTexture;
HavokPhysics().then((havok) => {
	// Havok is now available
	havokInstance = havok;
	//console.log("Havok Physics loaded:", havokInstance);
	// initialize the plugin using the HavokPlugin constructor
  const havokPlugin = new HavokPlugin(true, havokInstance);
	scene = createScene(havokPlugin);
	const camera = createCamera(scene);
	guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
	// Light
	const light = new HemisphericLight("light", new Vector3(0, 1, -1), scene);
	// Start game
	createPlayArea(scene);
	createCubes(scene);
	createControllableBalls(scene);
	engine.runRenderLoop(() => {
		scene && renderLoop(scene);
	});
});

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

// Create play area
function createPlayArea(scene: Scene) {
	// Floor
	const floor = MeshBuilder.CreateGround("floor", { width: 20, height: 10 }, scene);
	floor.position.y = 0;
	const floorMaterial = new StandardMaterial("floorMat", scene);
	floorMaterial.diffuseColor = new Color3(0.95, 0.65, 0.5);
	floor.material = floorMaterial;
	const floorProps = {
		mass: 0,
		restitution: 0.1,
		friction: 0.2,
	};
	const groundAggregate = new PhysicsAggregate(floor, PhysicsShapeType.BOX, floorProps, scene);

	// Base
	const base = MeshBuilder.CreateBox("base", { width: 22, height: 1, depth: 1 }, scene);
	base.position.set(0, 0.5, -5.5);
	const baseMaterial = new StandardMaterial("baseMat", scene);
	baseMaterial.diffuseColor = new Color3(0, 1, 0.5);
	base.material = baseMaterial;
	const baseProps = { mass: 0, restitution: 0.9 };
	const baseAggregate = new PhysicsAggregate(base, PhysicsShapeType.BOX, baseProps, scene);
}
function createScoreLabel(text: string, point: Vector3, duration: number) {
	// 2. Create the anchor at the hit point
	const anchor = new TransformNode("forceAnchor");
	anchor.position = point;

	// 3. Create the GUI Label
	const label = new TextBlock();
	label.text = text;
//	label.color = force > 10 ? "red" : "yellow"; // Color based on intensity
	label.fontSize = 40;
	label.color = "white";
	label.fontWeight = "bold";
	guiTexture.addControl(label);

	label.linkWithMesh(anchor);
	label.linkOffsetY = -30;

	// 4. Clean up
	setTimeout(() => {
			label.dispose();
			anchor.dispose();
	}, duration);
}

// Create controllable balls
function createControllableBalls(scene: Scene) {
	const hue = [10, 200, 300];
	const diameters = [0.9, 0.7, 0.5];
	const masses = [14, 9, 7];
	const restitution = [0.3, 0.6, 0.3];
	const friction = [0.2, 0.3, 0.4];
	const linearDamping = [0.2, 0.3, 0.5];
	for (let ix = 0; ix < 3; ix++) {
		const ball = MeshBuilder.CreateSphere("ball" + ix, { diameter: diameters[ix] }, scene);
		ball.position.set(ix, 2, 0);
		const material = new StandardMaterial("ballMat" + ix, scene);
		// Color code based on physics, e.g., hue based on mass
		material.diffuseColor = Color3.FromHSV(hue[ix], restitution[ix], friction[ix]);
		ball.material = material;
		const ballProps = {
			mass: masses[ix], restitution: restitution[ix], linearDamping: linearDamping[ix], angularDamping: 0.2, friction: friction[ix]
		};
		const body = new PhysicsAggregate(ball, PhysicsShapeType.SPHERE, ballProps, scene);
		body.body.setCollisionCallbackEnabled(true);
		body.body.getCollisionObservable().add(event => {
			// Handle collisions if needed
//			console.log("Collision detected", event);
			if(event.type !== "COLLISION_STARTED") return;
			const hitBody = event.collidedAgainst;
			// 2. Access the Mesh (TransformNode) linked to that body
			const hitMesh = hitBody.transformNode;
			if(hitMesh.name === "floor" || hitMesh.name === "base") return;
			// 3. Get the name
			const obj:GameObject|undefined = gameObjects.get(hitMesh.name);
			if (!obj) return;
			const go = obj as GameCube;
			const spawnType = go.spawnType;
			console.log("I hit: " + hitMesh.name, spawnType);
			if(!spawnType) return;
			if (spawnType.startsWith("Multiplier")) {
				const mult = parseInt(spawnType.split("=")[1]);
				const force = event.impulse;
				const points = Math.round(force * mult);
				gameState.scorePoints(points);
				createScoreLabel(points.toString(), event.point.clone(), 1000);
				// Display score text (simplified)
				//console.log("+" + points);
			} else if (spawnType === "Passive Ball") {
				spawnPassiveBall(scene);
				// Reset cube to inert for 5 seconds
				go.spawnType = "Inert";
				go.spawnTimer = 5;
			} else if (spawnType === "Gravity Adjust") {
				adjustGravity(scene);
				// Reset cube to inert for 5 seconds
				go.spawnType = "Inert";
				go.spawnTimer = 5;
			} else if (spawnType === "Extra Time") {
				gameState.extraTime(Math.random() * 3 + 3);
				// Reset cube to inert for 5 seconds
				go.spawnType = "Inert";
				go.spawnTimer = 5;
			} else if (spawnType === "Extra Ball") {
				gameState.extraBalls++;
				// Reset cube to inert for 5 seconds
				go.spawnType = "Inert";
				go.spawnTimer = 5;
			}
		});
		controllableBalls.push({ ball, body });
	}
}

// Create cubes
function createCubes(scene: Scene) {
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
		const go = new GameCube(name, cube, cubeBody, "Inert", Math.random()*2, false)
		gameObjects.set(cube.name, go)
		cubes.push(go);
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
		const go = new GameCube(name, cube, cubeBody, "Inert", Math.random()*2, false);
		gameObjects.set(cube.name, go);
		cubes.push(go);
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
		const go = new GameCube(name, cube, cubeBody, "Inert", Math.random()*2, false);
		gameObjects.set(cube.name, go);
		cubes.push(go);
	}
}

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
	forceVector.scaleInPlace(gameState.forceMultiplier * 2); // Minimal force
	if (forceVector.length() < 0.01) return; // Dead zone
	controllableBalls.forEach(ball => {
		const body = ball.body.body;
		// Only apply force if ball is on the ground
		//const radius = ball.diameter / 2;
//		console.log("Ball Y:", ball.position.y, "Radius:", ball);
		//        if (ball.position.y <= radius + 0.1) {
		body.applyImpulse(forceVector, ball.ball.getAbsolutePosition());
		//        }
	});
}

function spawnPassiveBall(scene: Scene) {
	const ball = MeshBuilder.CreateSphere("passiveBall", { diameter: Math.random() * 0.5 + 0.4 }, scene);
	ball.position.set(0, 2, 0);
	const material = new StandardMaterial("passiveMat", scene);
	material.diffuseColor = Color3.FromHSV(Math.random() * 360, 0.8, 0.6);
	ball.material = material;
//	ball.physicsImpostor = new PhysicsImpostor(ball, BABYLON.PhysicsImpostor.SphereImpostor, { mass: Math.random() * 0.5 + 0.1, restitution: 0.5, linearDamping: 0.2, angularDamping: 0.2, friction: 0.2 }, scene);
	passiveBalls.push(ball);
}

function adjustGravity(scene: Scene) {
	const gmx = (Math.random() - 0.5) * 2;
	const gmz = (Math.random() - 0.5) * 2;
	gameState.adjustGravity(new Vector3(gmx, 0, gmz));
}

function startGame() {
	gameStarted = true;
	gameOver = false;
	startElement && (startElement.style.display = "none");
	gameOverElement && (gameOverElement.style.display = "none");
	gameState = new GameState();
	gameState.startGame();
}

function renderLoop(scene: Scene) {
	if (!gameStarted || gameOver) {
		scene.render();
		return;
	}
	const deltaTime = gameState.getDeltaTime();
	applyForce();
	cubes.forEach(cube => cube.update(deltaTime));
	gameState.updateTimeRemaining(deltaTime);

	// Check if balls are out
	controllableBalls = controllableBalls.filter(ball => {
		if (ball.ball.position.y < -2 || Math.abs(ball.ball.position.x) > 11 || Math.abs(ball.ball.position.z) > 5) {
			if (gameState.extraBalls > 0) {
				gameState.extraBalls--;
				ball.ball.position.set(0, 2, 0);
				const body = ball.body.body;
				body.setLinearVelocity(Vector3.Zero());
				return true;
			} else {
				ball.ball.dispose();
				ball.body.dispose();
				return false;
			}
		}
		return true;
	});
	ballsElement && (ballsElement.textContent = (controllableBalls.length + gameState.extraBalls).toString());
	scene.render();
	if(gameState.isGameOver()) {
		gameOver = true;
		gameOverElement && (gameOverElement.style.display = "block");
	}
}
