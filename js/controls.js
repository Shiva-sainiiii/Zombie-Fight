// ============================================================
//  CONTROLS.JS — Keyboard & Mouse Input Handler
//
//  Tracks every key and mouse-button state so any system
//  can read it each frame without fighting over events.
// ============================================================

export class Controls {

    constructor() {

        // ── Key States ──────────────────────────────────────
        // Each flag is true while that key is held down.
        this.keys = {
            forward  : false,   // W / ArrowUp
            backward : false,   // S / ArrowDown
            left     : false,   // A / ArrowLeft
            right    : false,   // D / ArrowRight
            jump     : false,   // Space
            sprint   : false,   // Shift
            flashlight: false,  // F   (single-press toggle handled by Player)
            reload   : false,   // R
        };

        // ── Mouse State ──────────────────────────────────────
        this.mouse = {
            dx      : 0,        // pixels moved this frame (horizontal)
            dy      : 0,        // pixels moved this frame (vertical)
            shooting: false,    // true while left button held
            locked  : false,    // true while Pointer Lock is active
        };

        // Whether the controls are active (disabled on menus)
        this.enabled = false;

        this._bind();
        console.log('[Controls] Ready');
    }

    // ── Private: wire up DOM events ─────────────────────────
    _bind() {

        // Keyboard ↓
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            this._onKeyDown(e);
        });

        // Keyboard ↑
        document.addEventListener('keyup', (e) => {
            this._onKeyUp(e);
        });

        // Mouse move — only counts while pointer is locked
        document.addEventListener('mousemove', (e) => {
            if (!this.mouse.locked) return;
            // movementX/Y give raw pixel delta since last event
            this.mouse.dx += e.movementX || 0;
            this.mouse.dy += e.movementY || 0;
        });

        // Mouse button ↓
        document.addEventListener('mousedown', (e) => {
            if (!this.enabled || !this.mouse.locked) return;
            if (e.button === 0) this.mouse.shooting = true;  // Left click = shoot
        });

        // Mouse button ↑
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.shooting = false;
        });

        // Pointer Lock change — keep mouse.locked in sync
        document.addEventListener('pointerlockchange', () => {
            const canvas = document.getElementById('gameCanvas');
            this.mouse.locked = (document.pointerLockElement === canvas);
        });

        // Prevent context menu on right-click inside game
        document.getElementById('gameCanvas')
            ?.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ── Key → flag mapping ───────────────────────────────────
    _onKeyDown(e) {
        // Prevent browser shortcuts (Space scrolling, arrow-key scrolling)
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
            e.preventDefault();

        switch (e.code) {
            case 'KeyW': case 'ArrowUp':              this.keys.forward    = true; break;
            case 'KeyS': case 'ArrowDown':            this.keys.backward   = true; break;
            case 'KeyA': case 'ArrowLeft':            this.keys.left       = true; break;
            case 'KeyD': case 'ArrowRight':           this.keys.right      = true; break;
            case 'Space':                             this.keys.jump       = true; break;
            case 'ShiftLeft': case 'ShiftRight':      this.keys.sprint     = true; break;
            case 'KeyF':                              this.keys.flashlight = true; break;
            case 'KeyR':                              this.keys.reload     = true; break;
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':              this.keys.forward    = false; break;
            case 'KeyS': case 'ArrowDown':            this.keys.backward   = false; break;
            case 'KeyA': case 'ArrowLeft':            this.keys.left       = false; break;
            case 'KeyD': case 'ArrowRight':           this.keys.right      = false; break;
            case 'Space':                             this.keys.jump       = false; break;
            case 'ShiftLeft': case 'ShiftRight':      this.keys.sprint     = false; break;
            case 'KeyF':                              this.keys.flashlight = false; break;
            case 'KeyR':                              this.keys.reload     = false; break;
        }
    }

    // ── Public API ───────────────────────────────────────────

    /** Lock the pointer to the canvas (enables mouse-look) */
    requestPointerLock() {
        const canvas = document.getElementById('gameCanvas');
        if (canvas && document.pointerLockElement !== canvas) {
            canvas.requestPointerLock();
        }
    }

    /** Release pointer lock (menus / pause) */
    releasePointerLock() {
        if (document.pointerLockElement) document.exitPointerLock();
    }

    /** Enable input (call when game starts / resumes) */
    enable() {
        this.enabled = true;
    }

    /** Disable input (call on pause / game-over / menus) */
    disable() {
        this.enabled = false;
        // Clear all held keys so nothing sticks
        Object.keys(this.keys).forEach(k => this.keys[k] = false);
        this.mouse.shooting = false;
    }

    /**
     * Call at the END of each frame to clear accumulated mouse deltas.
     * Without this, mouse.dx/dy grow unbounded.
     */
    resetDeltas() {
        this.mouse.dx = 0;
        this.mouse.dy = 0;
    }
}
