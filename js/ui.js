// ============================================================
//  UI.JS — HUD & Menu Manager
//
//  All DOM manipulation lives here.
//  Other systems talk to UI by calling its methods;
//  menus talk back via callback functions.
// ============================================================

export class UI {

    constructor() {

        // Cache DOM element references once — cheaper than getElementById every frame
        this.el = {
            healthBar    : document.getElementById('health-bar'),
            healthText   : document.getElementById('health-text'),
            staminaBar   : document.getElementById('stamina-bar'),
            ammoCurrent  : document.getElementById('ammo-current'),
            ammoReserve  : document.getElementById('ammo-reserve'),
            killsCount   : document.getElementById('kills-count'),
            waveNumber   : document.getElementById('wave-number'),
            notification : document.getElementById('notification'),
            damageVig    : document.getElementById('damage-vignette'),
            loadingBar   : document.getElementById('loading-bar'),
            loadingMsg   : document.getElementById('loading-msg'),
            loadingScreen: document.getElementById('loading-screen'),
            mmCanvas     : document.getElementById('minimap-canvas'),
        };

        // 2D context for the minimap canvas
        this.mmCtx = this.el.mmCanvas?.getContext('2d');

        // Callbacks wired by Game
        this.onStart   = null;
        this.onResume  = null;
        this.onRestart = null;

        this._wireButtons();
        console.log('[UI] Ready');
    }

    // ─────────────────────────────────────────────────────
    //  Button wiring
    // ─────────────────────────────────────────────────────

    _wireButtons() {
        const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

        on('start-btn',      () => this.onStart?.());
        on('how-to-play-btn',() => this.showScreen('how-to-play'));
        on('back-btn',       () => this.showScreen('start-menu'));
        on('resume-btn',     () => this.onResume?.());
        on('restart-btn',    () => this.onRestart?.());
        on('play-again-btn', () => this.onRestart?.());
    }

    // ─────────────────────────────────────────────────────
    //  Loading screen
    // ─────────────────────────────────────────────────────

    setLoading(pct, msg) {
        if (this.el.loadingBar) this.el.loadingBar.style.width = pct + '%';
        if (this.el.loadingMsg) this.el.loadingMsg.textContent  = msg;
    }

    hideLoading() {
        const el = this.el.loadingScreen;
        if (!el) return;
        el.classList.add('fade');
        // Remove from DOM after fade completes
        setTimeout(() => el.style.display = 'none', 600);
    }

    // ─────────────────────────────────────────────────────
    //  Screen switching
    // ─────────────────────────────────────────────────────

    /**
     * Show one named screen, hide all others.
     * Pass null to hide everything (game running state).
     */
    showScreen(id) {
        ['start-menu','how-to-play','pause-menu','gameover-screen']
            .forEach(s => document.getElementById(s)?.classList.add('hidden'));

        if (id) document.getElementById(id)?.classList.remove('hidden');
    }

    showGameOver(kills, wave) {
        document.getElementById('final-kills').textContent = kills;
        document.getElementById('final-wave') .textContent = wave;
        this.showScreen('gameover-screen');
    }

    // ─────────────────────────────────────────────────────
    //  HUD value updates
    //  Called every frame — keep these cheap!
    // ─────────────────────────────────────────────────────

    updateHealth(current, max) {
        const pct = Math.max(0, (current / max) * 100);

        if (this.el.healthBar) {
            this.el.healthBar.style.width = pct + '%';

            // Colour shifts: green → orange → red as health drops
            if (pct > 60) {
                this.el.healthBar.style.background = 'linear-gradient(90deg,#990000,#ff3344)';
            } else if (pct > 30) {
                this.el.healthBar.style.background = 'linear-gradient(90deg,#994400,#ff8800)';
            } else {
                this.el.healthBar.style.background = 'linear-gradient(90deg,#660000,#cc0000)';
            }
        }

        if (this.el.healthText) this.el.healthText.textContent = Math.ceil(current);
    }

    updateStamina(current, max) {
        if (this.el.staminaBar)
            this.el.staminaBar.style.width = ((current / max) * 100) + '%';
    }

    updateAmmo(current, reserve) {
        if (this.el.ammoCurrent) {
            this.el.ammoCurrent.textContent  = current;
            this.el.ammoCurrent.style.color  = current <= 5 ? '#ff3333' : '#ff9900';
        }
        if (this.el.ammoReserve) this.el.ammoReserve.textContent = reserve;
    }

    updateKills(n) {
        if (this.el.killsCount) this.el.killsCount.textContent = n;
    }

    updateWave(n) {
        if (this.el.waveNumber) this.el.waveNumber.textContent = n;
    }

    // ─────────────────────────────────────────────────────
    //  Effects
    // ─────────────────────────────────────────────────────

    /** Flash red vignette when player takes damage */
    showDamageFlash() {
        const v = this.el.damageVig;
        if (!v) return;
        v.classList.add('flash');
        clearTimeout(this._vigTimer);
        this._vigTimer = setTimeout(() => v.classList.remove('flash'), 250);
    }

    /** Centred notification banner with auto-hide */
    showNotification(text, ms = 2500) {
        const el = this.el.notification;
        if (!el) return;
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(this._notifTimer);
        this._notifTimer = setTimeout(() => el.classList.remove('show'), ms);
    }

    // ─────────────────────────────────────────────────────
    //  Minimap
    // ─────────────────────────────────────────────────────

    /**
     * Redraws the minimap canvas every frame.
     *
     * @param {THREE.Vector3} playerPos
     * @param {Zombie[]}      zombies
     * @param {THREE.Mesh[]}  buildings
     * @param {number}        playerYaw  — camera yaw for direction arrow
     */
    updateMinimap(playerPos, zombies, buildings, playerYaw) {
        const ctx = this.mmCtx;
        if (!ctx) return;

        const W = 160, H = 160;
        // World units per minimap pixel (world is ±55 units = 110 wide)
        const SCALE = W / 110;
        const cx = W / 2, cy = H / 2;

        // World → canvas coord helper
        const wc = (x, z) => ({ px: cx + x * SCALE, py: cy + z * SCALE });

        // Clear
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(0,5,18,0.85)';
        ctx.fillRect(0, 0, W, H);

        // ── Buildings ──────────────────────────────────────
        if (buildings) {
            ctx.fillStyle = 'rgba(40,50,80,0.85)';
            buildings.forEach(b => {
                const p = wc(b.position.x, b.position.z);
                // Approximate size (buildings vary; use rough constant)
                const bw = 8 * SCALE, bh = 8 * SCALE;
                ctx.fillRect(p.px - bw/2, p.py - bh/2, bw, bh);
            });
        }

        // ── Zombies ───────────────────────────────────────
        ctx.fillStyle = '#ff2222';
        if (zombies) {
            zombies.forEach(z => {
                if (!z.isAlive) return;
                const p = wc(z.body.position.x, z.body.position.z);
                ctx.beginPath();
                ctx.arc(p.px, p.py, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // ── Player ────────────────────────────────────────
        if (playerPos) {
            const p = wc(playerPos.x, playerPos.z);

            // Dot
            ctx.fillStyle = '#00ff88';
            ctx.beginPath();
            ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
            ctx.fill();

            // Direction arrow (uses camera yaw)
            const yaw = (playerYaw || 0) + Math.PI;   // +PI because mesh faces opposite to yaw
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(
                p.px - Math.sin(yaw) * 9,
                p.py - Math.cos(yaw) * 9
            );
            ctx.stroke();
        }

        // ── Border ────────────────────────────────────────
        ctx.strokeStyle = 'rgba(0,255,136,0.3)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    }
}
