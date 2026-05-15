// ============================================================
//  AUDIO.JS — Sound Manager
//
//  Procedural audio via Web Audio API (no files needed).
//  When you add real sound files, swap the _proc* methods
//  for Howler calls — the event interface stays identical.
//
//  Listens for CustomEvents dispatched by Player & Zombie:
//    sfx:shoot       sfx:reload      sfx:hurt
//    sfx:zombieGrowl sfx:zombieDie
// ============================================================

export class AudioManager {

    constructor() {
        this.ctx   = null;   // AudioContext — created on first user gesture
        this.muted = false;
        this.ready = false;

        // ── Howler instances (commented out until you add real files) ──
        // this.sounds = {
        //   gunshot  : new Howl({ src: ['assets/sounds/gunshot.mp3'],  volume: 0.5 }),
        //   reload   : new Howl({ src: ['assets/sounds/reload.mp3'],   volume: 0.4 }),
        //   hurt     : new Howl({ src: ['assets/sounds/hurt.mp3'],     volume: 0.6 }),
        //   growl    : new Howl({ src: ['assets/sounds/growl.mp3'],    volume: 0.5 }),
        //   ambient  : new Howl({ src: ['assets/sounds/ambient.mp3'],  volume: 0.15, loop: true }),
        // };

        this._initOnGesture();
    }

    // ─────────────────────────────────────────────────────
    //  AudioContext must be created after a user gesture
    // ─────────────────────────────────────────────────────

    _initOnGesture() {
        const init = () => {
            if (this.ready) return;
            try {
                this.ctx   = new (window.AudioContext || window.webkitAudioContext)();
                this.ready = true;
                this._bindEvents();
                console.log('[Audio] Web Audio context started');
                document.removeEventListener('click',   init);
                document.removeEventListener('keydown', init);
            } catch (e) {
                console.warn('[Audio] Could not create AudioContext:', e);
            }
        };
        document.addEventListener('click',   init);
        document.addEventListener('keydown', init);
    }

    _bindEvents() {
        window.addEventListener('sfx:shoot',       () => this.playGunshot());
        window.addEventListener('sfx:reload',      () => this.playReload());
        window.addEventListener('sfx:hurt',        () => this.playHurt());
        window.addEventListener('sfx:zombieGrowl', () => this.playZombieGrowl());
    }

    // ─────────────────────────────────────────────────────
    //  Public API
    // ─────────────────────────────────────────────────────

    playGunshot() {
        if (!this.ready || this.muted) return;
        this._procGunshot();
    }

    playReload() {
        if (!this.ready || this.muted) return;
        this._procReload();
    }

    playHurt() {
        if (!this.ready || this.muted) return;
        this._procHurt();
    }

    playZombieGrowl() {
        if (!this.ready || this.muted) return;
        this._procGrowl();
    }

    /** Start looping ambient wind noise */
    startAmbience() {
        if (!this.ready || this.muted || this._ambienceRunning) return;
        this._procAmbience();
        this._ambienceRunning = true;
    }

    stopAmbience() {
        if (this._ambienceSource) {
            try { this._ambienceSource.stop(); } catch (e) {}
            this._ambienceSource     = null;
            this._ambienceRunning    = false;
        }
    }

    setMuted(v) {
        this.muted = v;
        if (this._masterGain) this._masterGain.gain.value = v ? 0 : 1;
    }

    // ─────────────────────────────────────────────────────
    //  Procedural sound generators
    //  (Replace these with Howler once you have audio files)
    // ─────────────────────────────────────────────────────

    /** Gunshot: short sawtooth burst decaying to silence */
    _procGunshot() {
        const ctx = this.ctx;
        const t   = ctx.currentTime;

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

        osc.start(t);
        osc.stop(t + 0.14);

        // Add a noise "crack"
        this._noiseBlip(0.12, 0.06);
    }

    /** Reload: two metallic clicks */
    _procReload() {
        [0, 0.35].forEach(delay => {
            const t   = this.ctx.currentTime + delay;
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);

            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

            osc.start(t);
            osc.stop(t + 0.05);
        });
    }

    /** Player hurt: low thud */
    _procHurt() {
        const ctx = this.ctx;
        const t   = ctx.currentTime;

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

        osc.start(t);
        osc.stop(t + 0.28);
    }

    /** Zombie growl: low warbling triangle wave */
    _procGrowl() {
        const ctx = this.ctx;
        const t   = ctx.currentTime;

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';

        // Warble the frequency
        osc.frequency.setValueAtTime(85, t);
        osc.frequency.setValueAtTime(60, t + 0.08);
        osc.frequency.setValueAtTime(95, t + 0.18);
        osc.frequency.setValueAtTime(70, t + 0.30);
        osc.frequency.setValueAtTime(55, t + 0.42);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

        osc.start(t);
        osc.stop(t + 0.55);
    }

    /** Ambient: filtered white noise = wind */
    _procAmbience() {
        const ctx = this.ctx;

        // Generate 2 seconds of white noise, then loop it
        const bufLen = ctx.sampleRate * 2;
        const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.loop   = true;

        const filter = ctx.createBiquadFilter();
        filter.type            = 'lowpass';
        filter.frequency.value = 180;
        filter.Q.value         = 0.4;

        const gain      = ctx.createGain();
        gain.gain.value = 0.025;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start();
        this._ambienceSource = source;
        this._ambienceGain   = gain;
    }

    /** Short white-noise blip (used for gunshot crack) */
    _noiseBlip(vol, dur) {
        const ctx    = this.ctx;
        const bufLen = Math.floor(ctx.sampleRate * dur);
        const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

        const src  = ctx.createBufferSource();
        src.buffer = buf;

        const gain      = ctx.createGain();
        gain.gain.value = vol;

        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
    }
}
