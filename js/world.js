// ============================================================
//  WORLD.JS — 3D Environment Builder
//
//  Creates the entire game scene:
//    • Sky colour & exponential fog
//    • Moon-light + hemisphere + atmospheric fills
//    • Ground plane (visual + physics)
//    • Invisible boundary walls
//    • Low-poly buildings with glowing windows
//    • Trees (stacked cones = low-poly classic)
//    • Scattered debris & street-lights
// ============================================================

import * as THREE from 'three';

// ── Map constants ─────────────────────────────────────────────
const MAP_HALF = 55;   // World extends ±55 units from centre

export class World {

    constructor(scene, physics) {
        this.scene   = scene;
        this.physics = physics;

        /** All Three.js objects so we can dispose them on reset */
        this.objects   = [];
        /** Building meshes exposed for minimap rendering */
        this.buildings = [];

        this._setupAtmosphere();
        this._setupLighting();
        this._setupGround();
        this._buildBoundaryWalls();
        this._spawnBuildings();
        this._spawnTrees();
        this._spawnDebrisAndLights();

        console.log('[World] Environment ready');
    }

    // ─────────────────────────────────────────────────────────
    //  Atmosphere
    // ─────────────────────────────────────────────────────────

    _setupAtmosphere() {
        // Dark indigo sky — feels like a moonless city night
        this.scene.background = new THREE.Color(0x07080f);

        // Exponential fog: objects fade to the sky colour with distance.
        // Density 0.022 means things ~80 units away are nearly invisible —
        // great for atmosphere AND hiding the map edge.
        this.scene.fog = new THREE.FogExp2(0x07080f, 0.022);
    }

    // ─────────────────────────────────────────────────────────
    //  Lighting
    // ─────────────────────────────────────────────────────────

    _setupLighting() {

        // ── Ambient (base fill) ───────────────────────────────
        // Very dim so shadows remain deep and dramatic.
        const ambient = new THREE.AmbientLight(0x111133, 0.6);
        this.scene.add(ambient);

        // ── Moon Light (main directional) ─────────────────────
        // Cool blue-white from upper-left; casts real-time shadows.
        this.moonLight = new THREE.DirectionalLight(0x4466cc, 1.4);
        this.moonLight.position.set(-15, 40, -10);
        this.moonLight.castShadow = true;

        // Shadow map settings ─────────────────────────────────
        // 2048² gives sharp shadows without being too expensive.
        const s = this.moonLight.shadow;
        s.mapSize.set(2048, 2048);
        s.camera.near   = 0.5;
        s.camera.far    = 150;
        s.camera.left   = -MAP_HALF;
        s.camera.right  =  MAP_HALF;
        s.camera.top    =  MAP_HALF;
        s.camera.bottom = -MAP_HALF;
        s.bias          = -0.001;   // Prevents shadow acne

        this.scene.add(this.moonLight);

        // ── Danger Fill (deep red from opposite side) ─────────
        // Subtle horror tint — barely visible but sets the mood.
        const danger = new THREE.DirectionalLight(0x330000, 0.35);
        danger.position.set(12, 8, 15);
        this.scene.add(danger);

        // ── Hemisphere (sky ↔ ground gradient) ────────────────
        // Sky colour blends slightly into the environment from above.
        const hemi = new THREE.HemisphereLight(0x111133, 0x000011, 0.4);
        this.scene.add(hemi);
    }

    // ─────────────────────────────────────────────────────────
    //  Ground
    // ─────────────────────────────────────────────────────────

    _setupGround() {

        // ── Visual ground mesh ────────────────────────────────
        const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 1, 1);
        const mat = new THREE.MeshLambertMaterial({ color: 0x141418 });
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x   = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this._track(ground);

        // ── Subtle grid overlay (cyberpunk vibe) ──────────────
        const grid = new THREE.GridHelper(MAP_HALF * 2, 40, 0x001133, 0x001133);
        grid.position.y = 0.02;   // Tiny offset to avoid z-fighting with ground
        grid.material.opacity     = 0.25;
        grid.material.transparent = true;
        this.scene.add(grid);
        this._track(grid);

        // ── Physics ground ────────────────────────────────────
        this.physics.createGround();
    }

    // ─────────────────────────────────────────────────────────
    //  Boundary walls (invisible — physics only)
    // ─────────────────────────────────────────────────────────

    _buildBoundaryWalls() {
        const H = 12;   // Wall height
        const T = 2;    // Wall thickness
        const E = MAP_HALF;

        // North, South, East, West walls
        const walls = [
            { x:  0,  z: -E,  w: E*2, d: T },
            { x:  0,  z:  E,  w: E*2, d: T },
            { x: -E,  z:  0,  w: T,   d: E*2 },
            { x:  E,  z:  0,  w: T,   d: E*2 },
        ];

        walls.forEach(({ x, z, w, d }) => {
            this.physics.createStaticBox(w, H, d, { x, y: H / 2, z });
        });
    }

    // ─────────────────────────────────────────────────────────
    //  Buildings
    // ─────────────────────────────────────────────────────────

    _spawnBuildings() {

        // Hand-placed building list: [x, z, width, height, depth]
        // Varied sizes and positions give a ruined city feel.
        const defs = [
            [ 14, -12,  8, 13,  8],
            [-18,  9,   6,  9, 10],
            [ 26, 20,  10, 16,  7],
            [-30, -16,  8, 11,  8],
            [ 10, 30,  12,  8,  9],
            [-20, 26,   7, 15,  6],
            [ 34, -5,   8, 11, 12],
            [-10, -30, 10,  9,  8],
            [  6, -22,  6, 13,  6],
            [-34, 11,   8,  6, 10],
            [ 42, 30,  14,  8, 14],
            [-42, -30, 12, 12, 10],
            [ 22, -38,  8, 18,  8],
            [-28, 40,   6,  7,  6],
        ];

        defs.forEach(([x, z, w, h, d], i) => this._makeBuilding(x, z, w, h, d, i));
    }

    _makeBuilding(x, z, w, h, d, idx) {

        // Colour palette: very dark, desaturated blues and charcoals
        const palette = [0x0e111e, 0x12182a, 0x0a0f1a, 0x191920, 0x101520];
        const color   = palette[idx % palette.length];

        // ── Main block ────────────────────────────────────────
        const geo  = new THREE.BoxGeometry(w, h, d);
        const mat  = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.buildings.push(mesh);   // Exposed for minimap
        this._track(mesh);

        // ── Physics collider ──────────────────────────────────
        this.physics.createStaticBox(w, h, d, { x, y: h / 2, z });

        // ── Rooftop trim ──────────────────────────────────────
        const trimGeo = new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3);
        const trimMat = new THREE.MeshLambertMaterial({
            color: 0x001833,
            emissive: 0x001133,
            emissiveIntensity: 0.6,
        });
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.set(x, h + 0.12, z);
        this.scene.add(trim);
        this._track(trim);

        // ── Windows ───────────────────────────────────────────
        this._addWindows(x, z, w, h, d);
    }

    _addWindows(bx, bz, w, h, d) {

        const litMat = new THREE.MeshLambertMaterial({
            color: 0xffbb44,
            emissive: 0xff9900,
            emissiveIntensity: 0.9,
        });
        const offMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });

        const cols = Math.max(1, Math.floor(w / 2.2));
        const rows = Math.max(1, Math.floor(h / 2.5));
        const winW = 0.75, winH = 0.7, winD = 0.08;
        const wGeo = new THREE.BoxGeometry(winW, winH, winD);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (Math.random() < 0.25) continue;   // Some windows missing
                const isLit = Math.random() > 0.45;

                const win = new THREE.Mesh(wGeo, isLit ? litMat : offMat);
                const wx  = bx - w / 2 + 1.1 + col * 2.2;
                const wy  = 1.4 + row * 2.5;
                win.position.set(wx, wy, bz + d / 2 + 0.04);
                this.scene.add(win);
                this._track(win);
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Trees
    // ─────────────────────────────────────────────────────────

    _spawnTrees() {

        for (let i = 0; i < 28; i++) {
            let x, z;
            // Keep trees away from the centre (player spawn)
            do {
                x = (Math.random() - 0.5) * (MAP_HALF * 1.8);
                z = (Math.random() - 0.5) * (MAP_HALF * 1.8);
            } while (Math.hypot(x, z) < 10);

            this._makeTree(x, z);
        }
    }

    _makeTree(x, z) {
        const group = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x2a1508 });
        const trunk    = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y  = 1.1;
        trunk.castShadow  = true;
        group.add(trunk);

        // Three stacked cones — simple low-poly foliage
        const foliageColors = [0x0c2b0c, 0x0a220a, 0x112e11];
        [0, 1, 2].forEach(i => {
            const coneGeo = new THREE.ConeGeometry(1.6 - i * 0.35, 2.0, 6);
            const coneMat = new THREE.MeshLambertMaterial({ color: foliageColors[i] });
            const cone    = new THREE.Mesh(coneGeo, coneMat);
            cone.position.y  = 2.8 + i * 1.4;
            cone.castShadow  = true;
            group.add(cone);
        });

        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(group);
        this._track(group);
    }

    // ─────────────────────────────────────────────────────────
    //  Debris & Street Lights
    // ─────────────────────────────────────────────────────────

    _spawnDebrisAndLights() {

        // ── Rubble chunks ─────────────────────────────────────
        const debrisMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });

        for (let i = 0; i < 50; i++) {
            const s   = Math.random() * 0.6 + 0.1;
            const geo = new THREE.BoxGeometry(s, s * 0.45, s);
            const m   = new THREE.Mesh(geo, debrisMat);
            m.position.set(
                (Math.random() - 0.5) * MAP_HALF * 1.8,
                s * 0.22,
                (Math.random() - 0.5) * MAP_HALF * 1.8
            );
            m.rotation.y   = Math.random() * Math.PI;
            m.receiveShadow = true;
            m.castShadow    = true;
            this.scene.add(m);
            this._track(m);
        }

        // ── Street lights ─────────────────────────────────────
        // Spaced along rough "roads" between buildings
        const lightPositions = [
            [-8, -8], [8, -8], [-8, 8], [8, 8],
            [0, -20], [0, 20], [-20, 0], [20, 0],
            [-14, 22], [14, 22], [-14, -22], [14, -22],
        ];
        lightPositions.forEach(([x, z]) => this._makeStreetLight(x, z));
    }

    _makeStreetLight(x, z) {
        const group = new THREE.Group();

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.5, 6);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const pole    = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y   = 2.75;
        pole.castShadow   = true;
        group.add(pole);

        // Head (lantern box)
        const headGeo = new THREE.BoxGeometry(0.6, 0.22, 0.6);
        const headMat = new THREE.MeshLambertMaterial({
            color: 0xffffaa,
            emissive: 0xffdd44,
            emissiveIntensity: 0.8,
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0.32, 5.6, 0);
        group.add(head);

        // Actual light — small radius, no shadow (too expensive for many lights)
        const ptLight = new THREE.PointLight(0xff9944, 2.0, 10);
        ptLight.position.set(0.32, 5.4, 0);
        ptLight.castShadow = false;
        group.add(ptLight);

        group.position.set(x, 0, z);
        this.scene.add(group);
        this._track(group);
    }

    // ─────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────

    /** Keep a reference so we can dispose everything on destroy */
    _track(obj) {
        this.objects.push(obj);
    }

    /** Clean up all scene objects (call before game reset) */
    destroy() {
        this.objects.forEach(obj => {
            this.scene.remove(obj);
            obj.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material))
                        child.material.forEach(m => m.dispose());
                    else
                        child.material.dispose();
                }
            });
        });
        this.objects   = [];
        this.buildings = [];
    }
}
