import { TransformNode, type Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

export class UIManager {
	scoreElement: HTMLElement|null = document.getElementById("score");
	timeElement: HTMLElement|null = document.getElementById("time");
	roundElement: HTMLElement|null = document.getElementById("round");
	ballsElement: HTMLElement|null = document.getElementById("balls");
	startElement: HTMLElement|null = document.getElementById("startMessage")
	gameOverElement: HTMLElement|null = document.getElementById("gameOver");
	versionElement: HTMLElement|null = document.getElementById("version");
	round(rn: number) {
		this.roundElement && (this.roundElement.textContent = rn.toString());
	}
	timeRemaining(tr: number) {
		this.timeElement && (this.timeElement.textContent = Math.ceil(tr).toString());
	}
	score(score: number) {
		this.scoreElement && (this.scoreElement.textContent = score.toString());
	}
	version(version: string) {
		this.versionElement && (this.versionElement.textContent = version);
	}
	balls(balls: number) {
		this.ballsElement && (this.ballsElement.textContent = balls.toString());
	}
	startMessage(show: boolean) {
		this.startElement && (this.startElement.style.display = show ? "block" : "none");
	}
	gameOver(show: boolean) {
		this.gameOverElement && (this.gameOverElement.style.display = show ? "block" : "none");
	}
}
let guiTexture: AdvancedDynamicTexture;
export function setGuiTexture(texture: AdvancedDynamicTexture) {
	guiTexture = texture;
}
export function createScoreLabel(text: string, point: Vector3, duration: number) {
	if(!guiTexture) return;
	// Create the anchor at the hit point
	const anchor = new TransformNode("forceAnchor");
	anchor.position = point;

	// Create the GUI Label
	const label = new TextBlock();
	label.text = text;
//	label.color = force > 10 ? "red" : "yellow"; // Color based on intensity
	label.fontSize = 40;
	label.color = "white";
	label.fontWeight = "bold";
	guiTexture.addControl(label);

	label.linkWithMesh(anchor);
	label.linkOffsetY = -30;

	// Clean up
	setTimeout(() => {
			label.dispose();
			anchor.dispose();
	}, duration);
}