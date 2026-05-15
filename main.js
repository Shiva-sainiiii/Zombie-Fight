// ============================================================
//  MAIN.JS — Game Entry Point & Central Orchestrator
//
//  Sets up Three.js renderer + scene, creates all subsystems,
//  manages game states and the main loop.
//
//  Game states:
//    LOADING  → MENU  → PLAYING  ↔  PAUSED
//                         ↓
//                      GAME_OVER → PLAYING (restart)
// ============================================================

import * as THREE from 'three';

// Our custom game modules
import { Controls     } from './js/controls.js';
import { Physics      } from './js/physics.js';
import { World        } from './js/world.js';
import { Player       } from './js/player.js';
import { Zombie       } from './js/zombie.js';
import { UI           } from './js/ui.js';
import { AudioManager } from './js/audio.js';

// ── Optional: uncomment when you add real 3D models ──────
// import { GLTFLoader    } from 'three/addons/loaders/GLTFLoader.js';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
//  GAME CLASS
// ============================================================

class Game {

    constructor() {
        this.state     = 'LOADING';   // Current game state
        this.wave      = 1;           // Current zombie wave
        this.zombies   = [];          // Active zombie instances
        this.clock     = new THREE.Clock();
        this.deltaTime = 0;

        // Subsystem references (populated in _init)
        this.renderer = null;
        this.scene    = null;
        this.camera   = null;
        this.controls = null;
        this.physics  = null;
        this.world    = null;
        this.player   = null;
        this.ui       = null;
        this.audio    = null;

        this._init();
    }

    // ─────────────────────────────────────────────────────
    //  Async initialisation (fake asset loading steps)
    // ─────────────────────────────────────────────────────

    async _init() {

        this.ui = new UI();
        this.ui.setLoading(5,  'Spinning up WebGL renderer…');
        await _tick();

        this._buildRenderer();
        this.ui.setLoading(20, 'Preparing scene & camera…');
        await _tick();

        this._buildScene();
        this.ui.setLoading(35, 'Initialising physics world…');
        await _tick();

        this.physics = new Physics();
        this.ui.setLoading(50, 'Generating environment…');
        await _tick();

        this.world = new World(this.scene, this.physics);
        this.ui.setLoading(65, 'Setting up input controls…');
        await _tick();

        this.controls = new Controls();
        this.ui.setLoading(75, 'Spawning player…');
        await _tick();

        this.player = new Player(
            this.scene, this.physics, this.controls, this.camera
        );
        this.ui.setLoading(88, 'Loading audio engine…');
        await _tick();

        this.audio = new AudioManager();
        this.ui.setLoading(100, 'All systems go!');
        await _wait(500);

        // Wire up cross-system events
        this._bindEvents();

        // Give UI buttons their action callbacks
        this.ui.onStart   = () => this.startGame();
        this.ui.onResume  = () => this.resumeGame();
        this.ui.onRestart = () => this.restartGame();

        // Transition to the main menu
        this.ui.hideLoading();
        this.ui.showScreen('start-menu');
        this.state = 'MENU';

        // Begin the render loop
        this._loop();

        console.log('[Game] Initialisation complete ✓');
    }

    // ─────────────────────────────────────────────────────
    //  Three.js Setup
    // ─────────────────────────────────────────────────────

    _buildRenderer() {
        const canvas = document.getElementById('gameCanvas');

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias      : true,
            powerPreference: 'high-performance',
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Cap pixel ratio at 2 — retina is nice but 3× is costly
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Real-time shadow maps
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

        // ACESFilmic tone-mapping gives a slightly filmic, gritty look
        this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.85;

        console.log('[Renderer] WebGL context ready');
    }

    _buildScene() {
        this.scene = new THREE.Scene();

        // 75° FOV feels natural for a third-person action game
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,   // Near clip plane
            250    // Far clip plane (beyond our fog density, so no pop-in)
        );
        this.camera.position.set(0, 6, 12);

        // Keep everything correct on window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // ─────────────────────────────────────────────────────
    //  Event Bindings
    // ─────────────────────────────────────────────────────

    _bindEvents() {

        // ESC key → pause / resume
        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Escape') return;
            if      (this.state === 'PLAYING') this.pauseGame();
            else if (this.state === 'PAUSED')  this.resumeGame();
        });

        // Clicking canvas → re-acquire pointer lock after alt-tab
        document.getElementById('gameCanvas')?.addEventListener('click', () => {
            if (this.state === 'PLAYING') this.controls.requestPointerLock();
        });

        // ── Player-emitted events ────────────────────────────
        window.addEventListener('player:died',    () => this._onPlayerDied());
        window.addEventListener('player:damaged', () => this.ui.showDamageFlash());

        // ── Zombie-emitted events ────────────────────────────
        window.addEventListener('zombie:died', () => this._checkWaveClear());

        // Zombie contact damage — rate limited by zombie deltaTime
        window.addEventListener('zombie:attack', (e) => {
            if (this.state === 'PLAYING') {
                this.player.takeDamage(e.detail.damage);
            }
        });
    }

    // ─────────────────────────────────────────────────────
    //  State Transitions
    // ─────────────────────────────────────────────────────

    startGame() {
        console.log('[Game] Starting game → Wave 1');
        this.state = 'PLAYING';
        this.wave  = 1;

        this.player.reset();
        this._clearZombies();
        this._spawnWave(this.wave);

        this.ui.showScreen(null);       // Hide all menus
        this.ui.updateWave(this.wave);
        this.ui.showNotification('⚠  WAVE 1 — SURVIVE!', 3000);

        this.controls.enable();
        this.controls.requestPointerLock();

        // Slight delay ensures user gesture has fired (needed for AudioContext)
        setTimeout(() => this.audio.startAmbience(), 300);

        this.clock.getDelta();          // Flush any accumulated delta during loading
    }

    pauseGame() {
        if (this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        this.controls.disable();
        this.controls.releasePointerLock();
        this.ui.showScreen('pause-menu');
    }

    resumeGame() {
        if (this.state !== 'PAUSED') return;
        this.state = 'PLAYING';
        this.controls.enable();
        this.controls.requestPointerLock();
        this.ui.showScreen(null);
        this.clock.getDelta();          // Prevent delta spike after pause
    }

    restartGame() {
        console.log('[Game] Restarting…');
        this.audio.stopAmbience();
        this._clearZombies();
        this.player.reset();
        this.controls.disable();
        this.controls.releasePointerLock();
        this.startGame();
    }

    // ─────────────────────────────────────────────────────
    //  Wave Management
    // ─────────────────────────────────────────────────────

    /**
     * Spawn zombies for a given wave number.
     * Formula: 6 + (wave-1)*3 zombies, each slightly faster/tankier.
     */
    _spawnWave(waveNum) {
        const count = 6 + (waveNum - 1) * 3;
        console.log(`[Game] Spawning ${count} zombies for wave ${waveNum}`);

        for (let i = 0; i < count; i++) {
            // Keep spawns away from player starting position (centre)
            let x, z;
            do {
                x = (Math.random() - 0.5) * 90;
                z = (Math.random() - 0.5) * 90;
            } while (Math.hypot(x, z) < 16);

            const zombie = new Zombie(this.scene, this.physics, { x, y: 0, z });

            // Scale difficulty with wave number
            zombie.chaseSpeed  += (waveNum - 1) * 0.25;
            zombie.health       = 50 + (waveNum - 1) * 12;
            zombie.maxHealth    = zombie.health;

            this.zombies.push(zombie);
        }
    }

    /** Destroy all zombie objects and clear the array */
    _clearZombies() {
        this.zombies.forEach(z => z.destroy());
        this.zombies = [];
    }

    /** Called each time a zombie emits zombie:died */
    _checkWaveClear() {
        const alive = this.zombies.filter(z => z.isAlive).length;
        if (alive > 0) return;

        // All dead — next wave in 5 seconds
        this.ui.showNotification(`✓  WAVE ${this.wave} CLEARED!  Next wave in 5s…`, 5000);

        setTimeout(() => {
            if (this.state !== 'PLAYING') return;

            // Dispose dead zombie meshes / textures
            this.zombies.forEach(z => z.destroy());
            this.zombies = [];

            this.wave++;
            this.ui.updateWave(this.wave);
            this._spawnWave(this.wave);
            this.ui.showNotification(`⚠  WAVE ${this.wave} — SURVIVE!`, 3000);
        }, 5000);
    }

    _onPlayerDied() {
        this.state = 'GAME_OVER';
        this.controls.disable();
        this.controls.releasePointerLock();
        this.audio.stopAmbience();

        // Small delay so player sees themselves fall
        setTimeout(() => {
            this.ui.showGameOver(this.player.kills, this.wave);
        }, 2200);
    }

    // ─────────────────────────────────────────────────────
    //  Main Render / Update Loop
    // ─────────────────────────────────────────────────────

    _loop() {
        // Schedule next frame first — smoother than scheduling at end
        requestAnimationFrame(() => this._loop());

        // Cap delta to 0.1 s so a frozen tab doesn't explode physics
        this.deltaTime = Math.min(this.clock.getDelta(), 0.1);

        if (this.state === 'PLAYING') this._update();

        // Always render — the 3D scene sits behind the menus
        this.renderer.render(this.scene, this.camera);

        // Must happen at end of frame — clears accumulated mouse deltas
        this.controls?.resetDeltas();
    }

    /**
     * Core simulation tick — only runs in PLAYING state.
     */
    _update() {
        const dt = this.deltaTime;

        // 1. Advance physics simulation
        this.physics.step(dt);

        // 2. Update player (movement, camera, shooting…)
        this.player.update(dt, this.zombies);

        // 3. Update every zombie AI
        const playerPos = this.player.getPosition();
        this.zombies.forEach(z => z.update(dt, playerPos));

        // 4. Sync HUD values
        const p = this.player;
        this.ui.updateHealth (p.health,  p.maxHealth);
        this.ui.updateStamina(p.stamina, p.maxStamina);
        this.ui.updateAmmo   (p.ammo,    p.reserveAmmo);
        this.ui.updateKills  (p.kills);

        // 5. Redraw minimap
        this.ui.updateMinimap(
            playerPos,
            this.zombies,
            this.world.buildings,
            p.yaw            // Camera yaw for directional arrow
        );
    }
}

// ============================================================
//  HELPERS
// ============================================================

/** Yield to the browser for one animation frame */
function _tick() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

/** Async sleep */
function _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
//  BOOTSTRAP — wait for DOM, then start
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[ZombieStrike 3D] Booting…');
    // Expose on window for browser-console debugging: game.player, game.zombies, etc.
    window.game = new Game();
});
