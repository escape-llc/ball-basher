import { Color3, InputBlock, NodeMaterial, Scene, Texture, Animation, TextureBlock, type IPhysicsCollisionEvent } from "@babylonjs/core";
import type { IGameController } from "./GameController";
import { animateHole, type GameObject } from "./GameObjects";
import tex_1x from "./assets/tex_1x.png";
import tex_2x from "./assets/tex_2x.png";
import tex_3x from "./assets/tex_3x.png";
import tex_4x from "./assets/tex_4x.png";
import tex_5x from "./assets/tex_5x.png";
import tex_10x from "./assets/tex_10x.png";
import tex_20x from "./assets/tex_20x.png";
import tex_25x from "./assets/tex_25x.png";
import tex_50x from "./assets/tex_50x.png";
import tex_m1x from "./assets/tex_minus1x.png";
import tex_m2x from "./assets/tex_minus2x.png";
import tex_m3x from "./assets/tex_minus3x.png";
import tex_m4x from "./assets/tex_minus4x.png";
import tex_m5x from "./assets/tex_minus5x.png";
import tex_m10x from "./assets/tex_minus10x.png";
import tex_m20x from "./assets/tex_minus20x.png";
import tex_m25x from "./assets/tex_minus25x.png";
import tex_m50x from "./assets/tex_minus50x.png";
import tex_et from "./assets/tex_et.png";
import tex_gravity from "./assets/tex_gravity.png";
import tex_inert from "./assets/tex_inert.png";
import { createLabelAt } from "./UIManager";

export type SpawnType = "Inert" | "Multiplier" | "Hole"
export interface ISpawnAction {
	get name(): string
	get duration(): number
	get object(): GameObject
	get expired(): boolean
	update(deltaMs: number): boolean
	execute(igc: IGameController): void
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void
}
interface ISpawnActionFactory {
	create(go: GameObject): ISpawnAction
}
export abstract class SpawnFactoryBase {
	protected spawnType: SpawnType
	private durationMin: number
	private durationRange: number
	protected color: Color3
	protected tex: Texture|null
	constructor(st: SpawnType, dm: number, dr: number, color: Color3, tex: Texture|null) {
		this.spawnType = st
		this.durationMin = dm
		this.durationRange = dr
		this.color = color
		this.tex = tex
	}
	protected makeDuration(): number { return this.durationMin + Math.round(this.durationRange*Math.random()) }
}
class InertFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	constructor(dm: number, dr: number, color: Color3, tex: Texture) {
		super("Inert", dm, dr, color, tex)
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_Inert(this.spawnType, this.makeDuration(), go, this.color, this.tex as Texture)
	}
}
class MultiplierFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	private _mult: number
	constructor(dm: number, dr: number, color: Color3, tex: Texture, mult: number) {
		super("Multiplier", dm, dr, color, tex)
		this._mult = mult
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_Multiplier(this.spawnType, this.makeDuration(), go, this.color, this.tex as Texture, this._mult)
	}
}
class HoleFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	constructor(dm: number, dr: number, color: Color3) {
		super("Hole", dm, dr, color, null)
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_Hole(this.spawnType, this.makeDuration(), go, this.color)
	}
}
class PassiveBallFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	constructor(dm: number, dr: number, color: Color3, tex: Texture) {
		super("Hole", dm, dr, color, tex)
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_PassiveBall(this.spawnType, this.makeDuration(), go, this.color, this.tex as Texture)
	}
}
class GravityAdjustFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	constructor(dm: number, dr: number, color: Color3, tex: Texture) {
		super("Hole", dm, dr, color, tex)
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_GravityAdjust(this.spawnType, this.makeDuration(), go, this.color, this.tex as Texture)
	}
}
class ExtraTimeFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	constructor(dm: number, dr: number, color: Color3, tex: Texture) {
		super("Hole", dm, dr, color, tex)
	}
	private makeExtraTime(): number {
		return 3 + Math.round(Math.random() * 3)
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_ExtraTime(this.spawnType, this.makeDuration(), go, this.color, this.tex as Texture, this.makeExtraTime())
	}
}
class ExtraBallFactory extends SpawnFactoryBase implements ISpawnActionFactory {
	constructor(dm: number, dr: number, color: Color3, tex: Texture) {
		super("Hole", dm, dr, color, tex)
	}
	create(go: GameObject): ISpawnAction {
		return new Spawn_ExtraBall(this.spawnType, this.makeDuration(), go, this.color, this.tex as Texture)
	}
}

export abstract class SpawnBase implements ISpawnAction {
	private go: GameObject
	protected dur: number
	private _name: string;
	constructor(nm: string, dur: number, go: GameObject) {
		this._name = nm
		this.dur = dur
		this.go = go
	}
	get expired(): boolean { return this.dur <= 0.0 }
	get name(): string { return this._name }
	get duration(): number { return this.dur }
	get object(): GameObject { return this.go }
	update(deltaMs: number): boolean {
		if(this.dur <= 0.0) return true;
		this.dur -= deltaMs
		return this.dur <= 0.0
	}
	abstract execute(igc: IGameController): void
	abstract collision(event: IPhysicsCollisionEvent, igc: IGameController): void
}
export abstract class SpawnWithColorAndTexture extends SpawnBase {
	private _color: Color3
	private _tex: Texture|null
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture|null) {
		super(nm, dur, go)
		this._color = col
		this._tex = tex
	}
	get color(): Color3 { return this._color }
	get texture(): Texture|null { return this._tex }
}
class Spawn_Inert extends SpawnWithColorAndTexture {
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture) {
		super(nm, dur, go, col, tex)
	}
	execute(igc: IGameController): void { }
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void { }
}
class Spawn_Hole extends SpawnWithColorAndTexture {
	constructor(nm: string, dur: number, go: GameObject, col: Color3) {
		super(nm, dur, go, col, null)
	}
	/**
	 * Do not accept updates; wait for the animation complete callback.
	 * @param deltaMs ignored
	 * @returns true: expired; false: not
	 */
	update(deltaMs: number): boolean {
		return this.dur <= 0.0;
	}
	execute(igc: IGameController): void {
		animateHole(this.object.mesh, this.duration * 1000).then(() => {
			this.dur = 0.0
		});
	}
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void { }
}
class Spawn_Multiplier extends SpawnWithColorAndTexture {
	private _mult: number
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture, mult: number) {
		super(nm, dur, go, col, tex)
		this._mult = mult
	}
	execute(igc: IGameController): void { }
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void {
		const force = event.impulse
		const points = Math.round(force * this._mult)
		igc.state.scorePoints(points)
		event.point && createLabelAt(points.toString(), points < 0 ? "red" : "white", event.point.clone(), 1000)
	}
}
export abstract class SpawnWithCount extends SpawnWithColorAndTexture {
	protected _maxcontact: number = 1
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture, maxc: number) {
		super(nm, dur, go, col, tex)
		this._maxcontact = maxc
	}
}
class Spawn_PassiveBall extends SpawnWithCount {
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture) {
		super(nm, dur, go, col, tex, 1)
	}
	execute(igc: IGameController): void { }
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void {
		if(this._maxcontact <= 0) return
		if(this.expired) return
		igc.spawnPassiveBall();
		this._maxcontact -= 1
		if(this._maxcontact <= 0) {
			this.dur = 0.0
		}
	}
}
class Spawn_ExtraTime extends SpawnWithCount {
	private _xtra: number
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture, xtra: number) {
		super(nm, dur, go, col, tex, 1)
		this._xtra = xtra
	}
	execute(igc: IGameController): void { }
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void {
		if(this._maxcontact <= 0) return
		if(this.expired) return
		igc.state.extraTime(this._xtra);
		this._maxcontact -= 1
		if(this._maxcontact <= 0) {
			this.dur = 0.0
		}
	}
}
class Spawn_ExtraBall extends SpawnWithCount {
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture) {
		super(nm, dur, go, col, tex, 1)
	}
	execute(igc: IGameController): void { }
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void {
		if(this._maxcontact <= 0) return
		if(this.expired) return
		igc.state.extraBalls++;
		this._maxcontact -= 1
		if(this._maxcontact <= 0) {
			this.dur = 0.0
		}
	}
}
class Spawn_GravityAdjust extends SpawnWithCount {
	constructor(nm: string, dur: number, go: GameObject, col: Color3, tex: Texture) {
		super(nm, dur, go, col, tex, 1)
	}
	execute(igc: IGameController): void { }
	collision(event: IPhysicsCollisionEvent, igc: IGameController): void {
		if(this._maxcontact <= 0) return
		if(this.expired) return
		igc.adjustGravity();
		this._maxcontact -= 1
		if(this._maxcontact <= 0) {
			this.dur = 0.0
		}
	}
}

function spawnColor(mult: number): Color3 {
	const hue = mult > 0 ? 240 - (mult / 32) * 120 : 0 + (Math.abs(mult) / 32) * 120;
	return Color3.FromHSV(hue, 0.8, 0.6);
}
function spawnTexture(scene: Scene, tx: any): Texture {
	let tex = new Texture(tx, scene)
	//tex.wAng = Math.PI / 2
	return tex
}
function createSpawnSequence(scene: Scene): ISpawnActionFactory[] {
	const hole = new HoleFactory(5, 5, new Color3(0.25, 0.25, 0.25))
	const passive = new PassiveBallFactory(2, 5, new Color3(1, 1, 0), spawnTexture(scene, tex_et))
	const gravity = new GravityAdjustFactory(2, 5, new Color3(0, 1, 1), spawnTexture(scene, tex_gravity))
	const xtime = new ExtraTimeFactory(2, 5, new Color3(1, 0, 1), spawnTexture(scene, tex_et))
	const xball = new ExtraBallFactory(2, 5, new Color3(0, 1, 0), spawnTexture(scene, tex_et))
	const spawnSequence: ISpawnActionFactory[] = [
		new MultiplierFactory(2, 5, spawnColor(1), spawnTexture(scene, tex_1x), 1),
		new MultiplierFactory(2, 5, spawnColor(2), spawnTexture(scene, tex_2x), 2),
		hole,
		new MultiplierFactory(2, 5, spawnColor(3), spawnTexture(scene, tex_3x), 3),
		new MultiplierFactory(2, 5, spawnColor(-1), spawnTexture(scene, tex_m1x), -1),
		new MultiplierFactory(2, 5, spawnColor(4), spawnTexture(scene, tex_4x), 4),
		new MultiplierFactory(2, 5, spawnColor(-2), spawnTexture(scene, tex_m2x), -2),
		hole,
		new MultiplierFactory(2, 5, spawnColor(5), spawnTexture(scene, tex_5x), 5),
		new MultiplierFactory(2, 5, spawnColor(-3), spawnTexture(scene, tex_m3x), -3),
		new MultiplierFactory(2, 5, spawnColor(10), spawnTexture(scene, tex_10x), 10),
		new MultiplierFactory(2, 5, spawnColor(-4), spawnTexture(scene, tex_m4x), -4),
		hole,
		new MultiplierFactory(2, 5, spawnColor(-5), spawnTexture(scene, tex_m5x), -5),
		new MultiplierFactory(2, 5, spawnColor(-10), spawnTexture(scene, tex_m10x), -10),
		passive, gravity, hole, xtime, passive, xball,
//		hole,
		new MultiplierFactory(2, 5, spawnColor(20), spawnTexture(scene, tex_20x), 20),
		gravity,
		new MultiplierFactory(2, 5, spawnColor(-20), spawnTexture(scene, tex_m20x), -20),
		xtime,
//		hole,
		new MultiplierFactory(2, 5, spawnColor(25), spawnTexture(scene, tex_25x), 25),
		gravity,
		new MultiplierFactory(2, 5, spawnColor(-25), spawnTexture(scene, tex_m25x), -25),
		xtime,
//		hole,
		new MultiplierFactory(2, 5, spawnColor(50), spawnTexture(scene, tex_50x), 50),
		gravity,
		new MultiplierFactory(2, 5, spawnColor(-50), spawnTexture(scene, tex_m50x), -50),
		xtime,
	]
	return spawnSequence;	
}

export class SpawnController {
	private igc: IGameController
	private spawns: Map<string, ISpawnAction> = new Map()
	private inert: InertFactory;
	private sequence: ISpawnActionFactory[]
	constructor(igc: IGameController) {
		this.igc = igc
		this.sequence = createSpawnSequence(igc.scene)
		this.inert = new InertFactory(1, 12, new Color3(0.5, 0.5, 0.5), spawnTexture(igc.scene, tex_inert))
	}
	protected spawnIndex(): number {
		const available = Math.min(this.igc.state.round + 10 - 1, this.sequence.length)
		return Math.floor(available*Math.random())
	}
	protected spawn(go: GameObject): ISpawnAction {
		return this.sequence[this.spawnIndex()].create(go)
	}
	start(): void {
		this.spawns.clear()
		this.igc.cubes.forEach(cx => {
			const action = this.inert.create(cx)
			if(action instanceof SpawnWithColorAndTexture) {
				this.initMaterial(action)
			}
			this.spawns.set(cx.name, action)
			action.execute(this.igc)
		})
	}
	update(deltaMs: number): void {
		for (const [key, value] of this.spawns) {
			const expired = value.update(deltaMs)
			if(expired) {
				const spx = value instanceof SpawnWithCount ? this.inert.create(value.object) : this.spawn(value.object)
				// transition
				this.spawns.delete(key)
				this.crossFade(spx as SpawnWithColorAndTexture, () => {
					this.spawns.set(key, spx)
					spx.execute(this.igc)
				})
			}
		}
	}
	collision(go: GameObject, event: IPhysicsCollisionEvent): void {
		console.log("collision", go.name, this.spawns.get(go.name))
		this.spawns.get(go.name)?.collision(event, this.igc)
	}
	initMaterial(newspawn: SpawnWithColorAndTexture): void {
		const mat = newspawn.object.material
		if(mat instanceof NodeMaterial) {
			const nextBaseColor = mat.getBlockByName("NextBaseColor") as InputBlock
			const nextTopTexture = mat.getBlockByName("NextTopTexture") as TextureBlock
			const xfade = mat.getBlockByName("CrossFade") as InputBlock
			if(!xfade || !nextTopTexture || !nextBaseColor) return;
			nextBaseColor.value = newspawn.color
			nextTopTexture.texture = newspawn.texture
			xfade.value = 1.0
		}
	}
	crossFade(newspawn: SpawnWithColorAndTexture, callback: () => void): void {
		const mat = newspawn.object.material
		if(mat instanceof NodeMaterial) {
			const currentBaseColor = mat.getBlockByName("CurrentBaseColor") as InputBlock
			const currentTopTexture = mat.getBlockByName("CurrentTopTexture") as TextureBlock
			const nextBaseColor = mat.getBlockByName("NextBaseColor") as InputBlock
			const nextTopTexture = mat.getBlockByName("NextTopTexture") as TextureBlock
			const xfade = mat.getBlockByName("CrossFade") as InputBlock
			if(!xfade || !nextTopTexture || !nextBaseColor || !currentTopTexture || !currentBaseColor) return;
			currentBaseColor.value = nextBaseColor.value
			currentTopTexture.texture = nextTopTexture.texture
			nextBaseColor.value = newspawn.color
			nextTopTexture.texture = newspawn.texture
			xfade.value = 0.0
			const xfadeAnim = new Animation("crossFade", "value", 30, Animation.ANIMATIONTYPE_FLOAT)
			const keys = [
				{ frame: 0, value: 0 },
				{ frame: 30, value: 1 }
			];
			xfadeAnim.setKeys(keys);
//			console.log("cross-fade start", newspawn.name, newspawn.object.name)
			this.igc.scene.beginDirectAnimation(xfade, [xfadeAnim], 0, 30, false, 1, () => {
//				console.log("cross-fade complete", newspawn.name, newspawn.object.name)
				callback()
			});
		}
	}
}