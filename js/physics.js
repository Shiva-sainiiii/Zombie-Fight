// ============================================================
//  PHYSICS.JS — cannon-es Physics World Wrapper
//
//  cannon-es is the maintained fork of cannon.js.
//  It provides rigid-body physics with collision detection.
//  We wrap it here so the rest of the game never touches the
//  cannon API directly — easier to swap engines later.
// ============================================================

// cannon-es is mapped in the importmap → cdn.jsdelivr
import * as CANNON from 'cannon-es';

export class Physics {

    constructor() {

        // ── Create World ─────────────────────────────────────
        // The World is the container for all physics objects.
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -22, 0)   // Gravity (m/s²) — slightly stronger than real life for snappier feel
        });

        // ── Broadphase ───────────────────────────────────────
        // Broadphase quickly finds pairs of objects that MIGHT
        // be colliding, so the expensive narrowphase check only
        // runs on those pairs.
        // SAPBroadphase (Sweep and Prune) is fast for many objects.
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);

        // Let sleeping bodies stop being simulated when at rest
        this.world.allowSleep = true;

        // ── Default Material ──────────────────────────────────
        // Materials define surface properties; ContactMaterial
        // defines what happens when two materials meet.
        this.mat = new CANNON.Material('default');

        const contact = new CANNON.ContactMaterial(this.mat, this.mat, {
            friction   : 0.25,   // Sliding resistance
            restitution: 0.05,   // Bounciness (0 = dead stop)
        });
        this.world.addContactMaterial(contact);
        this.world.defaultContactMaterial = contact;

        // Expose CANNON so other modules can import shapes etc.
        this.CANNON = CANNON;

        console.log('[Physics] World ready — gravity', this.world.gravity.y);
    }

    // ─────────────────────────────────────────────────────────
    //  Factory helpers — create pre-configured bodies
    // ─────────────────────────────────────────────────────────

    /**
     * Static horizontal ground plane at y = 0.
     * mass = 0 means it never moves.
     */
    createGround() {
        const body = new CANNON.Body({ mass: 0, material: this.mat });
        body.addShape(new CANNON.Plane());
        // Plane faces +Z by default; rotate it to face +Y (horizontal)
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(body);
        return body;
    }

    /**
     * Static box — used for buildings and boundary walls.
     * @param {number} w,h,d  Half-extents are computed inside.
     * @param {{x,y,z}} pos
     */
    createStaticBox(w, h, d, pos) {
        const body = new CANNON.Body({ mass: 0, material: this.mat });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
        body.position.set(pos.x, pos.y, pos.z);
        this.world.addBody(body);
        return body;
    }

    /**
     * Dynamic sphere — used for the player and zombies.
     * fixedRotation=true keeps characters upright (no tumbling).
     */
    createCharacterBody(radius, mass, pos) {
        const body = new CANNON.Body({
            mass,
            material     : this.mat,
            linearDamping : 0.98,   // Very high damping = character stops quickly (no sliding)
            angularDamping: 1.0,    // No angular spin
        });
        body.addShape(new CANNON.Sphere(radius));
        body.position.set(pos.x, pos.y, pos.z);
        body.fixedRotation = true;  // Lock rotation axis
        body.updateMassProperties();
        this.world.addBody(body);
        return body;
    }

    /**
     * Advance the simulation by deltaTime seconds.
     * fixedStep = 1/60 s; up to 3 sub-steps per frame so slow
     * frames don't cause tunnelling (objects passing through walls).
     */
    step(deltaTime) {
        this.world.step(1 / 60, deltaTime, 3);
    }

    /** Remove a body from the world (dead zombies, etc.) */
    removeBody(body) {
        if (body) this.world.removeBody(body);
    }
}
