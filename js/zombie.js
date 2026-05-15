// ============================================================
//  ZOMBIE.JS — Zombie Enemy AI
//
//  State machine: IDLE → ROAM → CHASE → ATTACK → DEAD
//
//  Each zombie has:
//    • Low-poly mesh with colour variation
//    • Canvas-based health bar (billboard sprite)
//    • cannon-es sphere body
//    • Simple path-following (no navmesh — straight-line)
//    • Walk/attack animation
//    • Hit-flash effect
// ============================================================

import * as THREE from 'three';

// State constants — readable strings make debugging easy
const S = {
    IDLE   : 'idle',
    ROAM   : 'roam',
    CHASE  : 'chase',
    ATTACK : 'attack',
    DEAD   : 'dead',
};

// Detection & attack radii
const DETECT_RANGE = 20;
const ATTACK_RANGE = 1.9;

export class Zombie {

    constructor(scene, physics, spawnPos) {
        this.scene   = scene;
        this.physics = physics;

        // ── Stats ──────────────────────────────────────────
        this.health    = 50;
        this.maxHealth = 50;
        this.isAlive   = true;

        // ── AI state ───────────────────────────────────────
        this.state      = S.IDLE;
        this.stateTimer = 0;

        // Roam target position
        this.roamTarget  = null;
        this.roamTimer   = 0;

        // Speeds
        this.roamSpeed  = 2.2;
        this.chaseSpeed = 4.2;

        // ── Animation ─────────────────────────────────────
        this.animT      = Math.random() * Math.PI * 2;   // Random phase offset
        this.deathTimer = 0;

        // ── Build ─────────────────────────────────────────
        this._buildMesh(spawnPos);
        this._buildBody(spawnPos);
        this._buildHealthBar();
    }

    // ─────────────────────────────────────────────────────
    //  Mesh
    // ─────────────────────────────────────────────────────

    _buildMesh(pos) {
        this.group = new THREE.Group();

        // Randomise colours so not every zombie looks identical
        const skins   = [0x2a5518, 0x3d6b1f, 0x1e4012, 0x4a7a28];
        const clothes  = [0x3a1616, 0x1a1a3a, 0x2e1a0a, 0x0d280d];
        const skin     = skins  [Math.floor(Math.random() * skins.length)];
        const cloth    = clothes[Math.floor(Math.random() * clothes.length)];

        const skinMat  = new THREE.MeshLambertMaterial({ color: skin  });
        const clothMat = new THREE.MeshLambertMaterial({ color: cloth });
        const eyeMat   = new THREE.MeshLambertMaterial({
            color: 0xff1100, emissive: 0xff0000, emissiveIntensity: 1.2,
        });

        // ── Legs (feet at y = 0) ──────────────────────────
        const legGeo = new THREE.BoxGeometry(0.23, 0.65, 0.23);
        this.legL = new THREE.Mesh(legGeo, clothMat);  this.legL.position.set(-0.16, 0.32, 0);
        this.legR = new THREE.Mesh(legGeo, clothMat);  this.legR.position.set( 0.16, 0.32, 0);

        // ── Torso ─────────────────────────────────────────
        const torsoGeo = new THREE.BoxGeometry(0.62, 0.72, 0.34);
        this.torso = new THREE.Mesh(torsoGeo, clothMat);  this.torso.position.set(0, 1.0, 0);

        // ── Head ──────────────────────────────────────────
        const headGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
        this.head = new THREE.Mesh(headGeo, skinMat);  this.head.position.set(0, 1.63, 0);

        // ── Red glowing eyes ──────────────────────────────
        const eyeGeo = new THREE.BoxGeometry(0.09, 0.07, 0.05);
        const eyeL   = new THREE.Mesh(eyeGeo, eyeMat);  eyeL.position.set(-0.11, 1.66, 0.23);
        const eyeR   = new THREE.Mesh(eyeGeo, eyeMat);  eyeR.position.set( 0.11, 1.66, 0.23);

        // ── Arms ──────────────────────────────────────────
        const armGeo = new THREE.BoxGeometry(0.21, 0.62, 0.21);
        this.armL = new THREE.Mesh(armGeo, skinMat);  this.armL.position.set(-0.44, 0.95, 0);
        this.armR = new THREE.Mesh(armGeo, skinMat);  this.armR.position.set( 0.44, 0.95, 0);

        [this.legL, this.legR, this.torso, this.head, eyeL, eyeR, this.armL, this.armR]
            .forEach(m => { m.castShadow = true; this.group.add(m); });

        this.group.position.set(pos.x, 0, pos.z);
        this.scene.add(this.group);
    }

    _buildBody(pos) {
        this.body = this.physics.createCharacterBody(0.5, 5, {
            x: pos.x, y: 1.5, z: pos.z
        });
    }

    // ─────────────────────────────────────────────────────
    //  Canvas health bar (billboard texture)
    // ─────────────────────────────────────────────────────

    _buildHealthBar() {
        this._hbCanvas  = document.createElement('canvas');
        this._hbCanvas.width  = 64;
        this._hbCanvas.height = 10;
        this._hbCtx     = this._hbCanvas.getContext('2d');
        this._hbTex     = new THREE.CanvasTexture(this._hbCanvas);

        const geo = new THREE.PlaneGeometry(1.1, 0.16);
        const mat = new THREE.MeshBasicMaterial({
            map: this._hbTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        this._hbMesh = new THREE.Mesh(geo, mat);
        this._hbMesh.position.y = 2.2;   // Float above head
        this.group.add(this._hbMesh);

        this._drawHealthBar();
    }

    _drawHealthBar() {
        const ctx = this._hbCtx;
        const w = 64, h = 10;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#220000';
        ctx.fillRect(0, 0, w, h);

        // Fill
        const pct = Math.max(0, this.health / this.maxHealth);
        ctx.fillStyle = pct > 0.5 ? '#00ee44' : pct > 0.25 ? '#ffaa00' : '#ff2200';
        ctx.fillRect(0, 0, Math.round(w * pct), h);

        this._hbTex.needsUpdate = true;
    }

    // ─────────────────────────────────────────────────────
    //  Per-Frame Update
    // ─────────────────────────────────────────────────────

    update(deltaTime, playerPos) {
        if (!this.isAlive) {
            this._updateDeath(deltaTime);
            return;
        }

        this.animT      += deltaTime;
        this.stateTimer += deltaTime;

        // Distance to player (XZ only for consistent ground AI)
        const dx   = playerPos.x - this.body.position.x;
        const dz   = playerPos.z - this.body.position.z;
        const dist = Math.hypot(dx, dz);

        // ── State machine ─────────────────────────────────
        switch (this.state) {
            case S.IDLE:   this._stateIdle  (deltaTime, dist);                break;
            case S.ROAM:   this._stateRoam  (deltaTime, dist);                break;
            case S.CHASE:  this._stateChase (deltaTime, dist, dx, dz);        break;
            case S.ATTACK: this._stateAttack(deltaTime, dist, dx, dz);        break;
        }

        // ── Sync mesh to body ─────────────────────────────
        // Body centre ≈ 0.5 when grounded → subtract to align feet
        this.group.position.set(
            this.body.position.x,
            this.body.position.y - 0.5,
            this.body.position.z
        );

        // ── Walk animation ────────────────────────────────
        this._animate();

        // ── Health bar always faces camera (rough billboard) ──
        // We can't easily look at camera inside zombie scope, so we
        // reset the pitch/roll only; yaw matches body.
        if (this._hbMesh) this._hbMesh.rotation.y = -this.group.rotation.y;

        // Safety fall recovery
        if (this.body.position.y < -8) {
            this.body.position.set(
                (Math.random() - 0.5) * 40,
                2,
                (Math.random() - 0.5) * 40
            );
            this.body.velocity.set(0, 0, 0);
        }
    }

    // ─────────────────────────────────────────────────────
    //  AI States
    // ─────────────────────────────────────────────────────

    _stateIdle(dt, dist) {
        // Stand around 1-3 s then roam
        if (this.stateTimer > 1 + Math.random() * 2) this._set(S.ROAM);
        // Notice player
        if (dist < DETECT_RANGE) this._alertPlayer();
    }

    _stateRoam(dt, dist) {
        // Pick a new random destination when the old one is reached / expires
        if (!this.roamTarget || this.roamTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const range = 10 + Math.random() * 12;
            this.roamTarget = {
                x: Math.max(-50, Math.min(50, this.body.position.x + Math.cos(angle) * range)),
                z: Math.max(-50, Math.min(50, this.body.position.z + Math.sin(angle) * range)),
            };
            this.roamTimer = 4 + Math.random() * 4;
        }

        this.roamTimer -= dt;

        // Move toward roam target
        const rdx  = this.roamTarget.x - this.body.position.x;
        const rdz  = this.roamTarget.z - this.body.position.z;
        const rdist = Math.hypot(rdx, rdz);

        if (rdist > 0.6) {
            this.body.velocity.x = (rdx / rdist) * this.roamSpeed;
            this.body.velocity.z = (rdz / rdist) * this.roamSpeed;
            this.body.wakeUp();
            this.group.rotation.y = Math.atan2(rdx, rdz);
        } else {
            this._set(S.IDLE);
        }

        if (dist < DETECT_RANGE) this._alertPlayer();
    }

    _stateChase(dt, dist, dx, dz) {
        // Lost player — go back to roam
        if (dist > DETECT_RANGE * 1.6) { this._set(S.ROAM); return; }
        // Close enough to attack
        if (dist < ATTACK_RANGE)       { this._set(S.ATTACK); return; }

        // Rush toward player
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
            this.body.velocity.x = (dx / d) * this.chaseSpeed;
            this.body.velocity.z = (dz / d) * this.chaseSpeed;
            this.body.wakeUp();
            this.group.rotation.y = Math.atan2(dx, dz);
        }
    }

    _stateAttack(dt, dist, dx, dz) {
        // Back to chase if player moves away
        if (dist > ATTACK_RANGE + 0.8) { this._set(S.CHASE); return; }

        // Slow shuffle while biting
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
            this.body.velocity.x = (dx / d) * 1.5;
            this.body.velocity.z = (dz / d) * 1.5;
            this.body.wakeUp();
            this.group.rotation.y = Math.atan2(dx, dz);
        }

        // Emit attack event — Game.js listens and applies damage to player
        window.dispatchEvent(new CustomEvent('zombie:attack', {
            detail: { damage: 8 * dt }   // 8 HP/s continuous damage
        }));
    }

    _alertPlayer() {
        this._set(S.CHASE);
        // Occasionally emit a growl sound event
        if (Math.random() < 0.3) {
            window.dispatchEvent(new CustomEvent('sfx:zombieGrowl'));
        }
    }

    _set(newState) {
        this.state      = newState;
        this.stateTimer = 0;
    }

    // ─────────────────────────────────────────────────────
    //  Animation
    // ─────────────────────────────────────────────────────

    _animate() {
        const vx    = this.body.velocity.x;
        const vz    = this.body.velocity.z;
        const speed = Math.hypot(vx, vz);

        const isMoving   = speed > 0.5;
        const isAttacking = this.state === S.ATTACK;

        if (isMoving || isAttacking) {
            const freq  = isAttacking ? 6 : 3.5;
            const swing = Math.sin(this.animT * freq);

            // Zombie outstretches arms while attacking
            if (isAttacking) {
                if (this.armL) this.armL.rotation.x = -0.9 + Math.sin(this.animT * 5) * 0.25;
                if (this.armR) this.armR.rotation.x = -0.9 + Math.sin(this.animT * 5 + Math.PI) * 0.25;
            } else {
                if (this.armL) this.armL.rotation.x =  swing * 0.5;
                if (this.armR) this.armR.rotation.x = -swing * 0.5;
            }

            if (this.legL) this.legL.rotation.x = -swing * 0.45;
            if (this.legR) this.legR.rotation.x =  swing * 0.45;

            // Head bob
            if (this.head) this.head.position.y = 1.63 + Math.sin(this.animT * freq * 2) * 0.025;
        } else {
            // Return to neutral
            [this.armL, this.armR, this.legL, this.legR].forEach(m => {
                if (m) m.rotation.x *= 0.85;
            });
        }
    }

    // ─────────────────────────────────────────────────────
    //  Death animation
    // ─────────────────────────────────────────────────────

    _updateDeath(dt) {
        this.deathTimer += dt;

        // Fall forward
        if (this.deathTimer < 0.6) {
            this.group.rotation.x = Math.min(Math.PI / 2, this.deathTimer * Math.PI * 1.5);
            this.group.position.y -= dt * 0.4;
        }

        // Fade out after 2.5 s — after 3 s Game.js destroys the object
        if (this.deathTimer > 2.5) {
            const fade = 1 - (this.deathTimer - 2.5) * 2;
            this.group.traverse(c => {
                if (c.material) {
                    c.material.transparent = true;
                    c.material.opacity     = Math.max(0, fade);
                }
            });
        }
    }

    // ─────────────────────────────────────────────────────
    //  Damage
    // ─────────────────────────────────────────────────────

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health -= amount;
        this._drawHealthBar();
        this._hitFlash();
        if (this.health <= 0) this._die();
    }

    _hitFlash() {
        // Briefly tint the zombie red
        this.group.traverse(c => {
            if (c.material) {
                c.material.emissive          = new THREE.Color(0xff0000);
                c.material.emissiveIntensity = 1;
            }
        });
        setTimeout(() => {
            if (!this.group) return;
            this.group.traverse(c => {
                if (c.material) {
                    c.material.emissive          = new THREE.Color(0x000000);
                    c.material.emissiveIntensity = 0;
                }
            });
        }, 100);
    }

    _die() {
        this.isAlive = false;
        this.state   = S.DEAD;
        this.physics.removeBody(this.body);
        if (this._hbMesh) this._hbMesh.visible = false;
        window.dispatchEvent(new CustomEvent('zombie:died'));
    }

    // ─────────────────────────────────────────────────────
    //  Cleanup
    // ─────────────────────────────────────────────────────

    destroy() {
        this.scene.remove(this.group);
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                    else c.material.dispose();
                }
            });
        }
        if (this._hbTex) this._hbTex.dispose();
    }
}
