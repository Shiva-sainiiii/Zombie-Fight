# 🧟 ZombieStrike 3D — Survival Game

> A complete, beginner-friendly browser-based 3D zombie survival game built with
> Three.js, cannon-es, GSAP, and Howler.js. No build tools. No npm. Open and play.

---

## 📁 Project Structure

```
zombie-game-project/
│
├── index.html          ← Entry point. All UI HTML + CDN imports
├── style.css           ← Full game styling (dark cyberpunk aesthetic)
├── main.js             ← Game orchestrator: renderer, loop, wave system
│
└── js/
    ├── controls.js     ← Keyboard + mouse input handler
    ├── physics.js      ← cannon-es physics world wrapper
    ├── world.js        ← Scene: lighting, ground, buildings, trees
    ├── player.js       ← Player: movement, camera, shooting, flashlight
    ├── zombie.js       ← Zombie AI: state machine, animation, health bar
    ├── ui.js           ← HUD, menus, minimap, notifications
    └── audio.js        ← Procedural Web Audio + Howler.js integration guide

assets/                 ← Add your models, textures, sounds here
    models/             ← .glb / .gltf 3D models
    textures/           ← .png / .jpg textures
    sounds/             ← .mp3 / .ogg audio files
```

---

## 🚀 How to Run Locally

### Option 1 — VS Code Live Server (Recommended)
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **"Open with Live Server"**
3. Browser opens automatically at `http://127.0.0.1:5500`

### Option 2 — Python (built-in, no install needed)
```bash
# Python 3
cd zombie-game-project
python -m http.server 8080

# Then open: http://localhost:8080
```

### Option 3 — Node.js (npx serve, one-liner)
```bash
cd zombie-game-project
npx serve .

# Then open the URL shown in terminal
```

### Option 4 — PHP
```bash
cd zombie-game-project
php -S localhost:8080
```

> ⚠️ **Why a local server?**
> ES modules (`type="module"`) and the import map require HTTP.
> Opening `index.html` directly as a `file://` URL will fail with a CORS error.

---

## 🎮 Controls

| Key / Action | Effect |
|---|---|
| `W A S D` | Move forward / left / backward / right |
| `SHIFT` | Sprint (drains stamina) |
| `SPACE` | Jump |
| `F` | Toggle flashlight |
| `Left Click` | Shoot |
| `R` | Reload magazine |
| `ESC` | Pause / Resume |

---

## 🛠️ Tech Stack (CDN — no installs)

| Library | Version | Purpose |
|---|---|---|
| [Three.js](https://threejs.org) | r160 | 3D rendering (WebGL) |
| [cannon-es](https://github.com/pmndrs/cannon-es) | 0.20.0 | Physics (gravity, collision) |
| [GSAP](https://greensock.com/gsap/) | 3.12.5 | UI animations (loaded, ready to use) |
| [Howler.js](https://howlerjs.com) | 2.2.4 | Audio (loaded, ready to wire up) |
| Web Audio API | Browser built-in | Procedural sounds (no files needed) |

---

## 🎯 Game Features

### ✅ Implemented
- **Third-person camera** — smooth mouse-look orbit around player
- **WASD movement** — camera-relative, normalised diagonal movement
- **Sprint + stamina** — stamina drains while sprinting, recovers at rest
- **Jump** — single jump with physics gravity
- **Flashlight** — SpotLight toggle with UI indicator
- **Hitscan shooting** — THREE.Raycaster from screen centre
- **Headshot detection** — head mesh = 2× damage (50 vs 25)
- **Gun recoil** — visual kick + camera pitch bump
- **Bullet tracer** — brief Line geometry on each shot
- **Muzzle flash** — emissive sphere + PointLight
- **Magazine reload** — R key or auto-reload when empty
- **Zombie AI** — 4-state machine: IDLE → ROAM → CHASE → ATTACK
- **Zombie animations** — walk cycle, arm swing, attack pose, death fall
- **Zombie health bars** — canvas texture billboard above each zombie
- **Hit flash** — red emissive tint on zombie when shot
- **Wave system** — each wave: +3 zombies, faster/tougher
- **Wave cleared** — 5-second intermission, then next wave spawns
- **HUD** — health bar, stamina bar, ammo counter, kill count, wave number
- **Minimap** — canvas 2D: player dot + direction arrow + zombies + buildings
- **Damage vignette** — red edge flash when player takes damage
- **Hit marker** — brief ✕ on-screen when a shot connects
- **Notifications** — centred banner messages
- **Procedural audio** — gunshot, reload, hurt, zombie growl, ambient wind
- **Dark atmosphere** — fog, moonlight, street lights, window glow
- **Low-poly buildings** — with glowing windows and physics colliders
- **Trees** — stacked cone low-poly style
- **Boundary walls** — physics-only invisible walls
- **Street lights** — PointLight arrays for local area glow
- **Debris** — scattered box rubble across the map
- **Game over screen** — shows kills and wave reached
- **Pause menu** — ESC to pause, pointer lock released
- **Start menu** — with how-to-play screen
- **Loading screen** — animated progress bar
- **Mobile responsive** — CSS adapts layout for smaller screens

### 🔲 Placeholder (ready to expand)
- **Inventory system** — hook into `player.inventory = []`
- **Mini-map** — already rendered; add more icons as needed
- **Ammo pickups** — spawn box meshes, check player proximity each frame

---

## 🔧 How to Extend the Game

### Add a Real 3D Model (GLTFLoader)
```javascript
// In player.js or zombie.js, import the loader:
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('assets/models/player.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.set(1, 1, 1);
    this.group.add(model);       // Attach to existing group
    this.group.remove(this.torso, this.head); // Remove placeholder boxes
});
```

### Add Real Gun Sounds (Howler.js)
```javascript
// In audio.js, replace _procGunshot() with:
this.sounds = {
    gunshot: new Howl({ src: ['assets/sounds/gunshot.mp3'], volume: 0.5 }),
    reload : new Howl({ src: ['assets/sounds/reload.mp3'],  volume: 0.4 }),
    growl  : new Howl({ src: ['assets/sounds/growl.mp3'],   volume: 0.5 }),
    ambient: new Howl({ src: ['assets/sounds/wind.mp3'], loop: true, volume: 0.15 }),
};

playGunshot() { this.sounds.gunshot.play(); }
```

### Add a Texture to the Ground
```javascript
// In world.js _setupGround():
const loader  = new THREE.TextureLoader();
const texture = loader.load('assets/textures/asphalt.jpg');
texture.repeat.set(20, 20);
texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
const mat = new THREE.MeshLambertMaterial({ map: texture });
```

### Add an Ammo Pickup
```javascript
// In world.js — spawn a glowing box:
_spawnAmmoPickup(x, z) {
    const geo  = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat  = new THREE.MeshLambertMaterial({
        color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.25, z);
    mesh.userData.isAmmo = true;
    this.scene.add(mesh);
    this.ammoPickups.push(mesh);
}

// In main.js _update() — check proximity each frame:
this.world.ammoPickups.forEach((pickup, i) => {
    pickup.rotation.y += dt;
    const d = pickup.position.distanceTo(playerPos);
    if (d < 1.5) {
        this.player.reserveAmmo = Math.min(180, this.player.reserveAmmo + 30);
        this.scene.remove(pickup);
        this.world.ammoPickups.splice(i, 1);
    }
});
```

### Add a Second Weapon (Shotgun)
```javascript
// In player.js — expand the shoot system:
this.weapons = ['pistol', 'shotgun'];
this.currentWeapon = 0;

// Shotgun: fire N rays in a spread pattern
_shotgunFire() {
    for (let i = 0; i < 8; i++) {
        const spread = 0.06;
        const dir = new THREE.Vector2(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread
        );
        this.raycaster.setFromCamera(dir, this.camera);
        // ... same hit detection as pistol
    }
}
```

---

## 🌐 Free Asset Resources

### 3D Models
| Site | Notes |
|---|---|
| [Sketchfab](https://sketchfab.com/features/free-3d-models) | Huge library, many free with CC licence |
| [Kenney.nl](https://kenney.nl/assets) | Low-poly packs, completely free |
| [Quaternius.com](https://quaternius.com) | Excellent free low-poly character packs |
| [Mixamo (Adobe)](https://www.mixamo.com) | Free rigged characters + animations |
| [Google Poly Archive](https://poly.pizza) | Community-preserved Poly models |
| [OpenGameArt](https://opengameart.org) | CC-licensed game assets |

### Textures
| Site | Notes |
|---|---|
| [Poly Haven](https://polyhaven.com/textures) | CC0 PBR textures, very high quality |
| [Ambientcg.com](https://ambientcg.com) | Free CC0 seamless textures |
| [Freepbr.com](https://freepbr.com) | Free PBR texture sets |
| [TextureCan](https://www.texturecan.com) | Wide variety of free textures |

### Sound Effects
| Site | Notes |
|---|---|
| [Freesound.org](https://freesound.org) | Huge CC0/CC library |
| [Zapsplat](https://zapsplat.com) | Free with free account |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Free, no attribution needed |
| [OpenGameArt Audio](https://opengameart.org/content/browse-all-audio) | Game-specific sounds |
| [Pixabay Audio](https://pixabay.com/sound-effects/) | Royalty-free |

---

## 🚢 Deployment Platforms

| Platform | How |
|---|---|
| **GitHub Pages** | Push to a repo → Settings → Pages → Deploy from branch |
| **Netlify** | Drag-and-drop the folder at netlify.com/drop |
| **Vercel** | `npx vercel` in the project folder |
| **Itch.io** | Zip the folder → upload as HTML5 game |
| **Cloudflare Pages** | Connect GitHub repo, auto-deploys on push |

> All platforms above serve files over HTTPS, which satisfies the ES module requirement.

---

## 📈 Performance Tips

1. **Reduce draw calls** — merge static geometry with `THREE.BufferGeometryUtils.mergeGeometries()`
2. **Use InstancedMesh** for zombies once count exceeds ~50
3. **LOD (Level of Detail)** — swap complex models for simpler ones at distance
4. **Frustum culling** — Three.js does this automatically; ensure `mesh.frustumCulled = true`
5. **Texture atlases** — pack all textures into one image, set UV offsets
6. **Shadow map cascade** — only the moon casts shadows; never add shadow to PointLights
7. **Object pooling** — reuse zombie/bullet objects instead of creating/destroying per wave
8. **Web Workers** — move physics to a Worker thread (requires Ammo.js WASM build)

---

## 🎨 Graphics Improvement Path

### Stage 1 — Better Textures (easy)
- Add `THREE.TextureLoader` for ground, walls, tree bark
- Enable `texture.anisotropy = renderer.capabilities.getMaxAnisotropy()`

### Stage 2 — PBR Materials (medium)
- Switch `MeshLambertMaterial` → `MeshStandardMaterial`
- Add `roughnessMap`, `normalMap`, `aoMap`

### Stage 3 — Post-Processing (advanced)
```javascript
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass     } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4,   // strength
    0.4,   // radius
    0.85   // threshold
));
// Call composer.render() instead of renderer.render()
```

### Stage 4 — Deferred Rendering / Shadows
- Switch to `THREE.VSMShadowMap` for softer shadows
- Use `CascadedShadowMaps` addon for large environments

---

## 🌐 Multiplayer Upgrade Path

### Phase 1 — Choose a Transport
| Option | Latency | Complexity | Best For |
|---|---|---|---|
| **Socket.io** (WebSocket) | ~20ms | Low | Authoritative server |
| **PeerJS** (WebRTC) | ~5ms | Medium | P2P (no server cost) |
| **Colyseus** | ~15ms | Medium | Game-specific rooms |
| **PlayCanvas Network** | ~15ms | Low | PlayCanvas ecosystem |

### Phase 2 — Architecture Pattern
```
CLIENT A                    SERVER                  CLIENT B
───────────                 ──────                  ───────────
Input (WASD)  →  send()  →  validate   →  broadcast()  →  Receive state
                            apply physics            Interpolate positions
                            update world state       Render remote players
```

### Phase 3 — Key Concepts to Implement
- **Client-side prediction** — apply input locally, reconcile with server
- **Entity interpolation** — smooth other players' positions between updates
- **Lag compensation** — rewind server state for hit detection
- **Delta compression** — only send changed values, not full state each frame

### Phase 4 — Recommended Stack
```javascript
// Server (Node.js + Colyseus)
npm install colyseus

// Client (add to index.html)
<script src="https://unpkg.com/colyseus.js@0.15/dist/colyseus.js"></script>

// In main.js
const client = new Colyseus.Client('ws://localhost:2567');
const room   = await client.joinOrCreate('survival', { playerName: 'Player1' });
room.onMessage('state', (state) => syncWorld(state));
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| Black screen | Open DevTools console — likely a JS import error |
| `CORS error` | Use a local server (not `file://`) |
| `cannon-es not found` | Check importmap URL; try `https://esm.sh/cannon-es@0.20.0` |
| Physics falls through floor | Body spawned below ground; increase spawn Y |
| Mouse look not working | Click the canvas first to request Pointer Lock |
| No sound | Click anywhere — AudioContext needs a user gesture |
| Low FPS | Reduce shadow map size to 1024; lower `pixelRatio` |
| Zombies stuck | They use straight-line pathfinding; buildings block them (intended) |

---

## 🗺️ Future Feature Roadmap

- [ ] Real GLTF character models (player + zombie)
- [ ] NavMesh pathfinding (three-pathfinding library)
- [ ] Multiple weapon types (shotgun, rifle, knife)
- [ ] Ammo & health pickups
- [ ] Zombie variants (runner, tank, spitter)
- [ ] Day/night cycle
- [ ] Destructible environment
- [ ] Leaderboard (localStorage)
- [ ] Mobile touch controls (joystick)
- [ ] Multiplayer (Colyseus or Socket.io)
- [ ] PBR textures + bloom post-processing
- [ ] Particle effects (blood splatter, muzzle smoke)
- [ ] Dynamic music system (intensity-based)

---

## 📄 Licence

MIT — free to use, modify, and distribute.
Include attribution if you use this as a foundation for a commercial project.

---

*Built with ❤️ using Three.js r160 · cannon-es 0.20.0 · Web Audio API*
