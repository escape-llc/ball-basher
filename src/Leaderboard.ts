export interface LeaderboardEntry {
	username: string;
	score: number;
}

export class GamePanel {
	// Vite dynamically pulls these variables depending on your build target context
	private readonly apiUrl: string = import.meta.env.VITE_API_URL;
	private readonly secretKey: string = "this_is_the_secret_key_omfg";

	// Explicit production origin string matching where your callback.php resides
	private readonly prodOrigin: string = "https://escape-technology-llc.com";

	private currentUserId: number | null = null;
	private userEmail: string | null = null;

	// DOM Elements Cached
	private panelContainer!: HTMLDivElement;
	private authSection!: HTMLDivElement;
	private gameSection!: HTMLDivElement;
	private leaderboardBody!: HTMLTableSectionElement;
	private statusText!: HTMLSpanElement;

	constructor() {
		console.log(`[Vite Env Initialize] API Base Route Target -> ${this.apiUrl}`);

		this.cacheDOM();
		this.bindEvents();
		this.checkExistingSession();
		this.setupAuthMessageListener();
	}

	private cacheDOM(): void {
		this.panelContainer = document.getElementById("gamePanel") as HTMLDivElement;
		this.authSection = document.getElementById("authSection") as HTMLDivElement;
		this.gameSection = document.getElementById("gameSection") as HTMLDivElement;
		this.leaderboardBody = document.getElementById("leaderboardData") as HTMLTableSectionElement;
		this.statusText = document.getElementById("statusText") as HTMLSpanElement;
	}

	private bindEvents(): void {
		const loginBtn = document.getElementById("googleLoginBtn");
		loginBtn?.addEventListener("click", () => this.initiateGoogleLogin());

		const logoutBtn = document.getElementById("logoutBtn");
		logoutBtn?.addEventListener("click", () => this.logout());

		const toggleBtn = document.getElementById("togglePanelBtn");
		toggleBtn?.addEventListener("click", () => this.togglePanelVisibility());

		window.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "h") {
				this.togglePanelVisibility();
			}
		});
	}

	private togglePanelVisibility(): void {
		const currentDisplay = this.panelContainer.style.display;
		if (currentDisplay === "none" || currentDisplay === "") {
			this.panelContainer.style.display = "block";
			this.refreshLeaderboard();
		} else {
			this.panelContainer.style.display = "none";
		}
	}

	private checkExistingSession(): void {
		const savedId = localStorage.getItem("game_user_id");
		const savedEmail = localStorage.getItem("game_user_email");
		if (savedId && savedEmail) {
			this.currentUserId = parseInt(savedId, 10);
			this.userEmail = savedEmail;
			this.updateUIVisibility(true);
		} else {
			this.updateUIVisibility(false);
		}
	}

	private updateUIVisibility(isLoggedIn: boolean): void {
		if (isLoggedIn && this.userEmail) {
			this.authSection.style.display = "none";
			this.gameSection.style.display = "block";
			this.statusText.innerText = `Player: ${this.userEmail}`;
		} else {
			this.authSection.style.display = "block";
			this.gameSection.style.display = "none";
			this.statusText.innerText = "Status: Not Signed In";
		}
	}
	public displayPanel(show: boolean): void {
		this.panelContainer.style.display = show ? "block" : "none";
		if(show) {
			this.refreshLeaderboard();
		}
	}
	/**
	 * Spawns a clean, centered popup window directing users safely to Google OAuth
	 */
	private async initiateGoogleLogin(): Promise<void> {
		try {
			this.statusText.innerText = "Connecting to authorization platform...";

			// Calls user.php to generate your secure authorization redirection URL string
			const response = await fetch(`${this.apiUrl}/user.php?action=google_login`);
			const data = await response.json();

			if (data.auth_url) {
				const width = 500;
				const height = 650;
				const left = window.screen.width / 2 - width / 2;
				const top = window.screen.height / 2 - height / 2;

				const popupOptions = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`;
				console.log("Opening authentication popup with URL:", data.auth_url);
				const authPopup = window.open(data.auth_url, "GoogleAuthPopup", popupOptions);

				if (!authPopup) {
					this.statusText.innerText = "Error: Pop-up blocker stopped authorization.";
					console.warn("Failed to open authentication popup. Please allow pop-ups for this site.");
				}
			} else {
				this.statusText.innerText = "Error: Invalid server auth parameters.";
				console.error("Server response missing 'auth_url':", data);
			}
		} catch (err) {
			console.error("Failed to initialize pop-up authentication workflow:", err);
			this.statusText.innerText = "Network pipeline error.";
		}
	}

	/**
	 * Hooks a long-running global messaging listener loop context.
	 * Captures incoming secure data streaming payloads sent from callback.php
	 */
	private setupAuthMessageListener(): void {
		window.addEventListener("message", (event: MessageEvent) => {
			// Strict Security Guard: Validate origin parameters cleanly.
			// Accepts cross-origin payloads during dev testing and production.
			const isProdOrigin = event.origin === this.prodOrigin;
			const isLocalOrigin = event.origin === window.location.origin;

			if (!isProdOrigin && !isLocalOrigin) {
				return; // Silently drop unverified frame messages
			}

			const result = event.data;
			if (result && result.type === "OAUTH_SUCCESS") {
				this.currentUserId = result.user_id;
				this.userEmail = result.email;

				// Store parameters long-term to remain logged in between page visits
				localStorage.setItem("game_user_id", result.user_id.toString());
				localStorage.setItem("game_user_email", result.email);

				this.updateUIVisibility(true);
				this.refreshLeaderboard();
			}
		});
	}

	public async refreshLeaderboard(): Promise<void> {
		this.leaderboardBody.innerHTML = '<tr><td colspan="3" class="center-text">Loading ranking values...</td></tr>';
		try {
			const response = await fetch(`${this.apiUrl}/leaderboard.php?action=get_top&limit=10`);
			const entries: LeaderboardEntry[] = await response.json();

			this.leaderboardBody.innerHTML = "";
			if (entries.length === 0) {
				this.leaderboardBody.innerHTML = '<tr><td colspan="3" class="center-text">No scores recorded yet.</td></tr>';
				return;
			}

			entries.forEach((item, index) => {
				const row = document.createElement("tr");
				const cleanName = item.username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
				row.innerHTML = `
                    <td class="rank-cell">#${index + 1}</td>
                    <td class="name-cell">${cleanName}</td>
                    <td class="score-cell">${parseInt(item.score as any).toLocaleString()}</td>
                `;
				this.leaderboardBody.appendChild(row);
			});
		} catch (err) {
			this.leaderboardBody.innerHTML = '<tr><td colspan="3" class="center-text error-text">Failed loading leaderboard records.</td></tr>';
		}
	}

	private async generateHMAC(userId: number, score: number): Promise<string> {
		const message = `${userId}${score}`;
		const encoder = new TextEncoder();
		const keyBuffer = encoder.encode(this.secretKey);
		const msgBuffer = encoder.encode(message);

		const cryptoKey = await window.crypto.subtle.importKey(
			"raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
		);
		const sigBuffer = await window.crypto.subtle.sign("HMAC", cryptoKey, msgBuffer);
		return Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
	}

	public async submitScore(score: number): Promise<void> {
		if (!this.currentUserId) {
			console.warn("Cannot post game scores: No active session player found.");
			return;
		}

		try {
			const hash = await this.generateHMAC(this.currentUserId, score);
			const response = await fetch(`${this.apiUrl}/leaderboard.php?action=submit_score`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: this.currentUserId, score: score, hash: hash })
			});
			const result = await response.json();
			console.log("Transmission Response Payload:", result);
			this.refreshLeaderboard();
		} catch (err) {
			console.error("Score synchronization connection error:", err);
		}
	}

	private logout(): void {
		localStorage.removeItem("game_user_id");
		localStorage.removeItem("game_user_email");
		this.currentUserId = null;
		this.userEmail = null;
		this.updateUIVisibility(false);
		this.refreshLeaderboard();
	}
}
