// ============================================================
//  PLAYER.JS — Player Character Controller
//
//  Responsibilities:
//    • Third-person camera orbit with mouse-look
//    • WASD movement relative to camera direction
//    • Sprint / stamina system
//    • Jump (single)
//    • Flashlight toggle
//    • Shooting (raycasting) + recoil
//    • Health & death
//    • Reload system
// ============================================================

import * as THREE from 'three';

export class Player {

    constructor(scene, physics, controls, camera) {
        this.scene    = scene;
        this.physics  = physics;
        this.controls = controls;
        this.camera   = camera;

        // ── Stats ────────────────────────────────────────────
        this.health        = 100;
        this.maxHealth     = 100;
        this.ammo          = 30;
        this.reserveAmmo   = 90;
        this.magazineSize  = 30;
        this.kills         = 0;
        this.stamina       = 100;
        this.maxStamina    = 100;
        this.isAlive       = true;

        // ── Movement tuning ───────────────────────────────────
        this.walkSpeed    = 8;
        this.sprintSpeed  = 14;
        this.jumpVelocity = 9;

        // ── Camera orbit state ────────────────────────────────
        // Horizontal angle (yaw) — controlled by mouse X
        this.yaw   = 0;
        // Vertical angle (pitch) — controlled by mouse Y; clamped
        this.pitch = 0.25;
        this.camDist   = 4.5;    // Distance behind player
        this.camHeight = 1.8;    // Height above player origin
        this.sensitivity = 0.0022;

        // ── Ground detection ──────────────────────────────────
        // We use a simple Y-position threshold (body radius = 0.5,
        // so centre is at ~0.5 when grounded).
        this.isOnGround = false;

        // ── Shoot / reload state ──────────────────────────────
        this.fireRate      = 0.13;   // Seconds between shots
        this.fireTimer     = 0;
        this.isReloading   = false;
        this.reloadTime    = 2.0;
        this.reloadTimer   = 0;

        // ── Flashlight ────────────────────────────────────────
        this.flashlightOn      = false;
        this.flashKeyHeld      = false;

        // ── Recoil animation ──────────────────────────────────
        this.recoil = 0;

        // ── Muzzle flash ──────────────────────────────────────
        this.muzzleTimer = 0;

        // Build everything
        this._buildMesh();
        this._buildPhysicsBody();
        this._buildFlashlight();
        this._buildGun();
        this._buildMuzzleFlash();

        // Raycaster for hitscan shooting
        this.raycaster = new THREE.Raycaster();

        // Smooth camera target (lerped each frame)
        this._camTarget = new THREE.Vector3();
        this._lookAtPos = new THREE.Vector3();

        console.log('[Player] Ready');
    }

    // ─────────────────────────────────────────────────────────
    //  Mesh Construction
    // ─────────────────────────────────────────────────────────

    _buildMesh() {
        this.group = new THREE.Group();

        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1e2d1e });   // Dark military green
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
        const eyeMat  = new THREE.MeshLambertMaterial({
            color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.2,
        });

        // Legs (feet at y = 0)
        const legGeo = new THREE.BoxGeometry(0.24, 0.65, 0.24);
        this.legL = new THREE.Mesh(legGeo, bodyMat);  this.legL.position.set(-0.16, 0.32, 0);
        this.legR = new THREE.Mesh(legGeo, bodyMat);  this.legR.position.set( 0.16, 0.32, 0);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.58, 0.72, 0.32);
        this.torso = new THREE.Mesh(torsoGeo, bodyMat);  this.torso.position.set(0, 1.01, 0);

        // Head
        const headGeo = new THREE.BoxGeometry(0.44, 0.44, 0.44);
        this.head = new THREE.Mesh(headGeo, skinMat);  this.head.position.set(0, 1.63, 0);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.07, 0.06);
        const eyeL   = new THREE.Mesh(eyeGeo, eyeMat);  eyeL.position.set(-0.11, 1.66, 0.22);
        const eyeR   = new THREE.Mesh(eyeGeo, eyeMat);  eyeR.position.set( 0.11, 1.66, 0.22);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        this.armL = new THREE.Mesh(armGeo, skinMat);  this.armL.position.set(-0.42, 0.95, 0);
        this.armR = new THREE.Mesh(armGeo, skinMat);  this.armR.position.set( 0.42, 0.95, 0);

        [this.legL, this.legR, this.torso, this.head, eyeL, eyeR, this.armL, this.armR]
            .forEach(m => { m.castShadow = true; this.group.add(m); });

        this.group.position.set(0, 0, 0);
        this.scene.add(this.group);
    }

    _buildPhysicsBody() {
        // Sphere body, radius 0.5, mass 80 kg
        // Resting on ground → centre at y ≈ 0.5
        this.body = this.physics.createCharacterBody(0.5, 80, { x: 0, y: 2, z: 0 });
    }

    _buildGun() {
        this.gunGroup = new THREE.Group();

        const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const grey = new THREE.MeshLambertMaterial({ color: 0x333333 });

        // Main body
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        this.gunGroup.add(new THREE.Mesh(bodyGeo, dark));

        // Barrel
        const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6);
        const barrel = new THREE.Mesh(barGeo, grey);
        barrel.rotation.x = Math.PI / 2;  barrel.position.z = 0.42;
        this.gunGroup.add(barrel);

        // Handle
        const handleGeo = new THREE.BoxGeometry(0.09, 0.22, 0.11);
        const handle    = new THREE.Mesh(handleGeo, dark);
        handle.position.set(0, -0.16, -0.08);
        this.gunGroup.add(handle);

        // Attach to player (right-hand position)
        this.gunGroup.position.set(0.28, 0.88, 0.4);
        this._gunRestZ = 0.4;     // Z at rest (for recoil)
        this.group.add(this.gunGroup);
    }

    _buildMuzzleFlash() {
        const geo = new THREE.SphereGeometry(0.14, 6, 6);
        const mat = new THREE.MeshLambertMaterial({
            color: 0xffcc44, emissive: 0xffcc44, emissiveIntensity: 2,
        });
        this.muzzleFlash = new THREE.Mesh(geo, mat);
        this.muzzleFlash.position.z = 0.65;
        this.muzzleFlash.visible    = false;
        this.gunGroup.add(this.muzzleFlash);

        this.muzzleLight = new THREE.PointLight(0xffaa22, 4, 6);
        this.muzzleLight.position.z = 0.65;
        this.muzzleLight.visible    = false;
        this.gunGroup.add(this.muzzleLight);
    }

    _buildFlashlight() {
        // SpotLight attached to player — swings with them
        this.flashlight = new THREE.SpotLight(0xffffff, 6, 22, Math.PI / 9, 0.35, 1.5);
        this.flashlight.position.set(0.2, 1.6, 0.4);
        this.flashlight.castShadow = false;   // Keep expensive shadow only on sun
        this.flashlight.visible    = false;

        // Spot needs a target object to point at
        this.flashlightTarget = new THREE.Object3D();
        this.scene.add(this.flashlightTarget);
        this.flashlight.target = this.flashlightTarget;

        this.group.add(this.flashlight);
    }

    // ─────────────────────────────────────────────────────────
    //  Per-Frame Update
    // ─────────────────────────────────────────────────────────

    update(deltaTime, zombies) {
        if (!this.isAlive) return;

        // Countdown timers
        this.fireTimer   = Math.max(0, this.fireTimer   - deltaTime);
        this.muzzleTimer = Math.max(0, this.muzzleTimer - deltaTime);

        if (this.muzzleTimer <= 0) {
            this.muzzleFlash.visible = false;
            this.muzzleLight.visible = false;
        }

        // ── Reload ────────────────────────────────────────────
        if (this.isReloading) {
            this.reloadTimer -= deltaTime;
            if (this.reloadTimer <= 0) this._finishReload();
        }

        // ── Flashlight toggle (single-press) ──────────────────
        if (this.controls.keys.flashlight && !this.flashKeyHeld) {
            this.flashKeyHeld = true;
            this._toggleFlashlight();
        }
        if (!this.controls.keys.flashlight) this.flashKeyHeld = false;

        // ── R = reload ────────────────────────────────────────
        if (this.controls.keys.reload && !this.isReloading
            && this.ammo < this.magazineSize && this.reserveAmmo > 0) {
            this._startReload();
        }

        // ── Camera & movement ──────────────────────────────────
        this._updateCamera(deltaTime);
        this._updateMovement(deltaTime);
        this._updateStamina(deltaTime);

        // ── Shooting ──────────────────────────────────────────
        if (this.controls.mouse.shooting && !this.isReloading) {
            this._shoot(zombies);
        }

        // ── Sync mesh to physics body ─────────────────────────
        // Body centre is at ~0.5 when grounded; mesh feet at y=0
        // so subtract 0.5 to align feet with ground.
        this.group.position.set(
            this.body.position.x,
            this.body.position.y - 0.5,
            this.body.position.z
        );

        // ── Ground check (position-based) ─────────────────────
        // Sphere radius = 0.5 → resting centre ≈ 0.5 + tiny float
        this.isOnGround = this.body.position.y < 0.65;

        // ── Flashlight aim ────────────────────────────────────
        if (this.flashlightOn) {
            const fwd = new THREE.Vector3(
                Math.sin(this.yaw),
                -Math.sin(this.pitch) * 0.4,
                Math.cos(this.yaw)
            );
            this.flashlightTarget.position
                .copy(this.group.position)
                .addScaledVector(fwd, 12);
        }

        // ── Recoil recovery ───────────────────────────────────
        this.recoil = Math.max(0, this.recoil - deltaTime * 6);
        this.gunGroup.position.z = this._gunRestZ - this.recoil * 0.25;

        // ── Walk animation ────────────────────────────────────
        this._animateLegs(deltaTime);

        // Safety: fell off map
        if (this.body.position.y < -10) {
            this.body.position.set(0, 3, 0);
            this.body.velocity.set(0, 0, 0);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Camera
    // ─────────────────────────────────────────────────────────

    _updateCamera(deltaTime) {
        // Apply mouse delta to angles
        if (this.controls.mouse.locked) {
            this.yaw   -= this.controls.mouse.dx * this.sensitivity;
            this.pitch -= this.controls.mouse.dy * this.sensitivity;
        }

        // Clamp pitch so player can't look too far up/down
        this.pitch = Math.max(-0.35, Math.min(0.75, this.pitch));

        // Orbit camera position around player
        const px = this.group.position.x;
        const py = this.group.position.y;
        const pz = this.group.position.z;

        const targetX = px + Math.sin(this.yaw)   * this.camDist;
        const targetY = py + this.camHeight + this.pitch * 1.8;
        const targetZ = pz + Math.cos(this.yaw)   * this.camDist;

        // Smooth camera position (lerp 15% per frame)
        this._camTarget.set(targetX, targetY, targetZ);
        this.camera.position.lerp(this._camTarget, 0.14);

        // Look at a point slightly above the player's centre
        this._lookAtPos.set(px, py + 0.8, pz);
        this.camera.lookAt(this._lookAtPos);

        // Rotate player mesh to face camera direction (plus 180°)
        this.group.rotation.y = this.yaw + Math.PI;
    }

    // ─────────────────────────────────────────────────────────
    //  Movement
    // ─────────────────────────────────────────────────────────

    _updateMovement(deltaTime) {
        const sprint  = this.controls.keys.sprint && this.stamina > 0;
        const speed   = sprint ? this.sprintSpeed : this.walkSpeed;
        const k       = this.controls.keys;

        // Build move vector in local space
        let mx = 0, mz = 0;
        if (k.forward)  mz -= 1;
        if (k.backward) mz += 1;
        if (k.left)     mx -= 1;
        if (k.right)    mx += 1;

        // Normalise diagonal movement
        const len = Math.hypot(mx, mz);
        if (len > 0) { mx /= len; mz /= len; }

        // Rotate move vector to match camera yaw
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        const worldX = mx * cos - mz * sin;
        const worldZ = mx * sin + mz * cos;

        // Apply to physics velocity (preserve Y for gravity / jumping)
        this.body.velocity.x = worldX * speed;
        this.body.velocity.z = worldZ * speed;
        this.body.wakeUp();

        // Jump
        if (k.jump && this.isOnGround) {
            this.body.velocity.y = this.jumpVelocity;
            this.isOnGround      = false;
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Stamina
    // ─────────────────────────────────────────────────────────

    _updateStamina(deltaTime) {
        const sprinting = this.controls.keys.sprint;
        const moving    = this.controls.keys.forward || this.controls.keys.backward
                        || this.controls.keys.left   || this.controls.keys.right;

        if (sprinting && moving) {
            this.stamina = Math.max(0, this.stamina - deltaTime * 22);
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + deltaTime * 12);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Shooting (Hitscan raycasting)
    // ─────────────────────────────────────────────────────────

    _shoot(zombies) {
        if (this.fireTimer > 0) return;

        if (this.ammo <= 0) {
            if (!this.isReloading && this.reserveAmmo > 0) this._startReload();
            return;
        }

        // Consume ammo & reset fire timer
        this.ammo--;
        this.fireTimer   = this.fireRate;

        // Muzzle flash
        this.muzzleFlash.visible = true;
        this.muzzleLight.visible = true;
        this.muzzleTimer         = 0.06;

        // Recoil kick
        this.recoil  = 1;
        this.pitch   = Math.min(0.75, this.pitch + 0.012);   // Slight upward camera kick

        // ── Raycast from screen centre ────────────────────────
        // NDC(0,0) = screen centre → ray goes exactly where crosshair is.
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        // Collect all zombie child meshes to test against
        const targets = [];
        zombies.filter(z => z.isAlive).forEach(z => {
            z.group.traverse(child => {
                if (child.isMesh) {
                    child.userData.zombieRef = z;   // Back-reference for damage
                    targets.push(child);
                }
            });
        });

        const hits = this.raycaster.intersectObjects(targets, false);

        if (hits.length > 0) {
            const hitMesh = hits[0].object;
            const zombie  = hitMesh.userData.zombieRef;

            if (zombie && zombie.isAlive) {
                // Headshots (hit mesh is the head) do double damage
                const isHead   = hitMesh === zombie.head;
                const damage   = isHead ? 50 : 25;
                zombie.takeDamage(damage);
                if (!zombie.isAlive) this.kills++;
            }

            this._showHitMarker();
        }

        // Visual bullet tracer
        this._spawnTracer();

        // Notify audio
        window.dispatchEvent(new CustomEvent('sfx:shoot'));
    }

    _spawnTracer() {
        const dir = this.raycaster.ray.direction.clone();
        const start = this.raycaster.ray.origin.clone();
        const end   = start.clone().addScaledVector(dir, 60);

        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.55 });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        // Auto-remove after 50 ms
        setTimeout(() => {
            this.scene.remove(line);
            geo.dispose();
            mat.dispose();
        }, 55);
    }

    _showHitMarker() {
        const el = document.getElementById('hit-marker');
        if (!el) return;
        el.classList.add('show');
        clearTimeout(this._hmTimer);
        this._hmTimer = setTimeout(() => el.classList.remove('show'), 90);
    }

    // ─────────────────────────────────────────────────────────
    //  Reload
    // ─────────────────────────────────────────────────────────

    _startReload() {
        if (this.isReloading || this.reserveAmmo <= 0 || this.ammo === this.magazineSize) return;
        this.isReloading = true;
        this.reloadTimer = this.reloadTime;
        document.getElementById('reload-hud')?.classList.add('show');
        window.dispatchEvent(new CustomEvent('sfx:reload'));
    }

    _finishReload() {
        const needed    = this.magazineSize - this.ammo;
        const available = Math.min(needed, this.reserveAmmo);
        this.ammo        += available;
        this.reserveAmmo -= available;
        this.isReloading  = false;
        document.getElementById('reload-hud')?.classList.remove('show');
    }

    // ─────────────────────────────────────────────────────────
    //  Flashlight
    // ─────────────────────────────────────────────────────────

    _toggleFlashlight() {
        this.flashlightOn        = !this.flashlightOn;
        this.flashlight.visible  =  this.flashlightOn;

        const el = document.getElementById('flashlight-hud');
        const tx = document.getElementById('fl-text');
        if (tx) tx.textContent = this.flashlightOn ? 'ON' : 'OFF';
        el?.classList.add('show');
        clearTimeout(this._flTimer);
        this._flTimer = setTimeout(() => el?.classList.remove('show'), 1800);
    }

    // ─────────────────────────────────────────────────────────
    //  Walk Animation
    // ─────────────────────────────────────────────────────────

    _animateLegs(dt) {
        const moving = this.controls.keys.forward  || this.controls.keys.backward
                    || this.controls.keys.left     || this.controls.keys.right;

        if (!this._walkT) this._walkT = 0;
        if (moving) this._walkT += dt * (this.controls.keys.sprint ? 10 : 6);

        const swing = moving ? Math.sin(this._walkT) * 0.45 : 0;

        if (this.legL) this.legL.rotation.x =  swing;
        if (this.legR) this.legR.rotation.x = -swing;
        if (this.armL) this.armL.rotation.x = -swing * 0.6;
        if (this.armR) this.armR.rotation.x =  swing * 0.6;
    }

    // ─────────────────────────────────────────────────────────
    //  Health / Death
    // ─────────────────────────────────────────────────────────

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health = Math.max(0, this.health - amount);
        window.dispatchEvent(new CustomEvent('sfx:hurt'));
        window.dispatchEvent(new CustomEvent('player:damaged'));
        if (this.health <= 0) this._die();
    }

    _die() {
        this.isAlive = false;
        this.group.rotation.x = Math.PI / 2;   // Fall forward
        window.dispatchEvent(new CustomEvent('player:died'));
    }

    // ─────────────────────────────────────────────────────────
    //  Getters & Reset
    // ─────────────────────────────────────────────────────────

    /** Returns a THREE.Vector3 of current physics position */
    getPosition() {
        return new THREE.Vector3(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
    }

    /** Reset for a new game */
    reset() {
        this.health       = 100;
        this.ammo         = 30;
        this.reserveAmmo  = 90;
        this.kills        = 0;
        this.stamina      = 100;
        this.isAlive      = true;
        this.isReloading  = false;
        this.reloadTimer  = 0;
        this.fireTimer    = 0;
        this.recoil       = 0;
        this.yaw          = 0;
        this.pitch        = 0.25;

        this.body.position.set(0, 2, 0);
        this.body.velocity.set(0, 0, 0);
        this.group.rotation.x = 0;
        this.flashlightOn = false;
        this.flashlight.visible = false;
        document.getElementById('reload-hud')?.classList.remove('show');
    }

    destroy() {
        this.scene.remove(this.group);
        this.scene.remove(this.flashlightTarget);
        this.physics.removeBody(this.body);
    }
}
