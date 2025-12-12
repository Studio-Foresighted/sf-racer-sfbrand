import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { GameScene } from './core/scene.js';
import { PhysicsWorld } from './physics/rapierSetup.js';
import { VehiclePhysics } from './cars/vehiclePhysics.js';
import { CarVisual } from './cars/carVisual.js';
import { CarLoader } from './cars/carLoader.js';
import { InputController } from './input/inputController.js';
import { GarageUI } from './ui/garage.js';
import { PauseMenu } from './ui/pauseMenu.js';
import { HUD } from './ui/hud.js';
import { Time } from './util/time.js';
import { LapSystem } from './core/lapSystem.js';
import { MapEditor } from './ui/mapEditor.js';
import { MilestoneSystem } from './ui/milestones.js';
import { FreeCamera } from './core/freeCamera.js';

// Future Multiplayer: CarState definition
class CarState {
    constructor() {
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.physicsRotation = new THREE.Quaternion();
        this.linearVelocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
        this.steering = 0;
        this.throttle = 0;
        this.brake = 0;
    }
    
    updateFromPhysics(vehicle) {
        if (!vehicle || !vehicle.chassisBody) return;
        
        const t = vehicle.chassisBody.translation();
        const visualRot = vehicle.getVisualRotation();
        const physRot = vehicle.getRotation();
        const lv = vehicle.chassisBody.linvel();
        const av = vehicle.chassisBody.angvel();
        
        this.position.set(t.x, t.y, t.z);
        this.rotation.copy(visualRot);
        this.physicsRotation.copy(physRot);
        this.linearVelocity.set(lv.x, lv.y, lv.z);
        this.angularVelocity.set(av.x, av.y, av.z);
    }
}

class Game {
    constructor() {
        this.renderer = new Renderer();
        this.time = new Time();
        this.input = new InputController((key) => this.handleInput(key));
        this.physics = new PhysicsWorld();
        this.loader = new CarLoader();
        
        this.scene = null;
        this.vehicle = null;
        this.visual = null;
        this.garage = null;
        this.pauseMenu = null;
        this.hud = null;
        this.paused = false;
        this.lapSystem = null;
        this.milestones = null;
        this.coins = 0;
        
        this.raceStarted = false;
        this.raceTime = 0;
        this.preStartInput = { throttle: 0, steering: 0, brake: 0 };
        this.prevRaceStarted = false;
        
        this.localCarState = new CarState();

        this.cameraOffset = new THREE.Vector3(0, 5, -10);
        this.cameraLookAtOffset = new THREE.Vector3(0, 0, 5); // Look ahead
        
        this.freeCamera = null;
        
        // Banner Placement System
        this.bannerGhost = null;
        this.bannerTexture = null;
        this.bannerScale = 1.0;
        
        // Permanent Banners
        this.banners = [];
        this.selectedBannerIndex = -1;
        this.wireframeBox = null;
    }

    async init() {
        this.startGimmickLoop();

        // Define onRaceFinished callback
        this.onRaceFinished = () => {
            this.raceStarted = false;
            if (this.hud) {
                this.hud.showFinish(() => {
                    // Restart Logic
                    // 1. Reset Car Position
                    this.resetCar(true);
                    // 2. Reset Lap System
                    if (this.lapSystem) {
                        const coinModel = this.mapEditor ? this.mapEditor.coinModel : null;
                        this.lapSystem.updateCheckpoints(this.lapSystem.checkpoints, coinModel); // Reset state with coins
                    }
                    // 3. Reset Timer
                    this.raceTime = 0;
                    // 4. Reset Points
                    if (this.hud) {
                        this.hud.resetCoins();
                    }
                    // 5. Show Countdown again
                    this.hud.showCountdown(() => {
                        this.raceStarted = true;
                    });
                });
            }
        };

        const updateProgress = (msg, percent) => {
            const bar = document.getElementById('progress-bar');
            const text = document.getElementById('loading-text');
            if (bar) bar.style.width = `${percent * 100}%`;
            if (text) text.textContent = msg;
        };

        try {
            // 1. Init Physics (0-10%)
            updateProgress("Initializing Physics Engine...", 0.05);
            await this.physics.init();
            updateProgress("Physics Ready", 0.10);

            // 2. Setup Scene & Load Track (10-30%)
            this.scene = new GameScene(this.physics);
            updateProgress("Loading Track Data...", 0.15);
            await this.scene.loadTrack();
            updateProgress("Building Environment...", 0.30);
            
            this.visual = new CarVisual(this.scene.threeScene);

            // 3. Preload All Cars (30-90%)
            // First load manifest
            await this.loader.loadManifest();
            
            // Then preload models
            await this.loader.preloadAllCars((name, progress) => {
                // Map 0-1 progress to 0.3-0.9 range
                const totalProgress = 0.3 + (progress * 0.6);
                updateProgress(`Loading ${name}...`, totalProgress);
            });

            // 4. Setup UI & Systems (90-100%)
            updateProgress("Finalizing UI...", 0.95);
            
            this.pauseMenu = new PauseMenu(this);
            this.hud = new HUD(this);
            this.lapSystem = new LapSystem(this);
            this.mapEditor = new MapEditor(this);
            this.milestones = new MilestoneSystem(this);
            this.freeCamera = new FreeCamera(this.renderer.camera, this.renderer.renderer.domElement);

            // Load Banner Texture
            const texLoader = new THREE.TextureLoader();
            this.bannerTexture = await new Promise(resolve => {
                texLoader.load('./assets/ui/artworx-kart-banner.png', (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    resolve(tex);
                }, undefined, () => resolve(null));
            });

            // Create Permanent Banners
            if (this.bannerTexture) {
                this.createPermanentBanners();
            }

            this.garage = new GarageUI(this, this.loader, (carId) => this.onCarSelect(carId));
            if (this.hud) this.hud.hide();
            
            await this.garage.init();

            updateProgress("Ready!", 1.0);

            // Hide Overlay after short delay
            setTimeout(() => {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) overlay.style.display = 'none';
                this.stopGimmickLoop();
            }, 500);

        } catch (e) {
            console.error("Initialization Failed:", e);
            updateProgress("Error Loading Game. Check Console.", 0);
        }

        // 9. Start Loop (Always start loop so we can debug if needed)
        this.renderer.renderer.setAnimationLoop(() => this.update());
    }

    startGimmickLoop() {
        const el = document.getElementById('gimmick-text');
        if (!el) return;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const screenRes = `${window.innerWidth}x${window.innerHeight}`;
        const orientation = window.innerWidth > window.innerHeight ? "Landscape" : "Portrait";
        
        // Try to guess location from timezone for "accuracy"
        let locationGuess = "Unknown";
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) {
                locationGuess = tz.split('/')[1] || tz;
                locationGuess = locationGuess.replace(/_/g, ' ');
            }
        } catch (e) {}

        // 1. Priority Gimmicks (Stats) - MUST SHOW FIRST IN THIS ORDER
        const priorityGimmicks = [
            `Detected Screen: ${screenRes} (${orientation})`,
            `Screen Rank: Top ${Math.floor(Math.random() * 20 + 1)}% in World`,
            `Simulating IP Location: ${locationGuess}`,
            `Simulating Download Speed: ${(Math.random() * 50 + 50).toFixed(1)} MB/s`
        ];

        // 2. Random Gimmicks (Fun)
        const randomGimmicks = [
            "Adjusting mirrors...",
            "Checking blinker fluid...",
            "Calibrating Flux Capacitor...",
            "Greasing the wheels...",
            isMobile ? "Mobile Device Detected: Optimizing Shaders..." : "Desktop Detected: Unlocking High Res...",
            "Downloading more RAM...",
            "Reticulating Splines...",
            "Warming up the engine...",
            "Scanning for shortcuts...",
            "Polishing chrome...",
            `User Agent: ${navigator.platform}`,
            "Inflating tires...",
            "Compiling shaders...",
            "Generating terrain...",
            "Checking internet connection... It works!",
            "Locating nearest pizza place...",
            "Calculating pi...",
            "Buckle up!"
        ];

        // Randomize the rest
        randomGimmicks.sort(() => Math.random() - 0.5);

        // Combine: Priority first, then randoms
        const gimmicks = [...priorityGimmicks, ...randomGimmicks];

        let index = 0;

        // Safe HTML escape to avoid accidental injection when using innerHTML
        const escapeHtml = (unsafe) => {
            return String(unsafe)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        // Format gimmick lines: keep label (before first colon) in yellow/bold
        // and render the 'value' (after first colon) in a white span for emphasis.
        const formatGimmick = (text) => {
            if (!text || typeof text !== 'string') return escapeHtml(String(text));
            const m = text.match(/^(.*?):\s*(.*)$/);
            if (m) {
                const label = escapeHtml(m[1]);
                const value = escapeHtml(m[2]);
                return `${label}: <span class="gimmick-value">${value}</span>`;
            }
            return escapeHtml(text);
        };

        const showNext = () => {
            el.style.opacity = 0;
            setTimeout(() => {
                el.innerHTML = formatGimmick(gimmicks[index]);
                el.style.opacity = 1;
                index = (index + 1) % gimmicks.length;
            }, 500);
        };

        showNext(); // Show first immediately
        this.gimmickInterval = setInterval(showNext, 3000);
    }

    stopGimmickLoop() {
        if (this.gimmickInterval) clearInterval(this.gimmickInterval);
    }

    createPermanentBanners() {
        const aspect = this.bannerTexture.image.width / this.bannerTexture.image.height;
        const geometry = new THREE.PlaneGeometry(aspect, 1);
        const material = new THREE.MeshBasicMaterial({ 
            map: this.bannerTexture, 
            side: THREE.DoubleSide
        });
        
        // Backing Block
        const boxGeo = new THREE.BoxGeometry(aspect, 1, 0.1);
        const boxMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const configs = [
            {
                pos: { x: 0.974, y: 13.952, z: -30.808 },
                rot: { x: -0.008, y: 0.000, z: 0.000 },
                scale: 4.797
            },
            {
                pos: { x: 0.902, y: 13.927, z: -31.853 },
                rot: { x: -3.135, y: 0.002, z: -3.141 },
                scale: 4.797
            }
        ];

        configs.forEach((cfg, index) => {
            const group = new THREE.Group();
            
            // Banner
            const mesh = new THREE.Mesh(geometry, material);
            // Move banner slightly forward so it doesn't z-fight with box
            mesh.position.z = 0.06; 
            group.add(mesh);
            
            // Backing
            const box = new THREE.Mesh(boxGeo, boxMat);
            group.add(box);
            
            // Apply Transform
            group.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z);
            group.rotation.set(cfg.rot.x, cfg.rot.y, cfg.rot.z);
            group.scale.set(cfg.scale, cfg.scale, cfg.scale);
            
            this.scene.threeScene.add(group);
            this.banners.push(group);
        });

        // Create Wireframe Helper (hidden initially)
        // We'll scale it to match the selected banner later
        const wireGeo = new THREE.BoxGeometry(aspect, 1, 0.2); // Match aspect roughly
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
        this.wireframeBox = new THREE.Mesh(wireGeo, wireMat);
        this.wireframeBox.visible = false;
        this.scene.threeScene.add(this.wireframeBox);
    }

    async onCarSelect(carId) {
        console.log(`Selected Car: ${carId}`);
        // Instant switch now, no loading screen needed
        const model = await this.loader.loadCarModel(carId); // Will return cached immediately
        
        if (!model) {
            console.error("Failed to load car model");
            return;
        }

        this.visual.setModel(model);
        
        // Collapse Garage UI (instead of hiding)
        if (this.garage) this.garage.collapse();
        
        if (this.hud) {
            this.hud.show();
            // Start Countdown when car is ready
            this.hud.showCountdown(() => {
                console.log("GO!");
                this.raceStarted = true;
                this.raceTime = 0;
            });
        } else {
            // Fallback if HUD is missing (should not happen)
            console.warn("HUD missing, starting race immediately");
            this.raceStarted = true;
            this.raceTime = 0;
        }

        // Reset Physics Vehicle if exists, or create new
        if (this.vehicle) {
            // Reset Position
            this.vehicle.chassisBody.setTranslation({ x: 0, y: 2.0, z: 0 }, true);
            this.vehicle.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            this.vehicle.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
            
            // Face Backward (-Z) - Reverted as requested
            this.vehicle.chassisBody.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true);
        } else {
            // Create Physics Vehicle
            this.vehicle = new VehiclePhysics(this.physics, { x: 0, y: 2.0, z: 0 });
            // Face Backward (-Z)
            this.vehicle.chassisBody.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true);
        }

        // Connect Jump Callback
        this.vehicle.onJumpCallback = (dist) => {
            if (this.hud) {
                this.hud.addJump(dist);

                // Award Points (1 pt per meter), rounded to nearest (.5 rounds up via Math.round)
                const points = Math.round(dist);
                this.hud.collectCoin(points);

                // Show Floating Text above the car
                if (this.vehicle) {
                    const pos = this.vehicle.getPosition();
                    pos.y += 2.0;
                    this.hud.showFloatingPoints(points, pos);
                }
            }
        };
    }

    handleInput(key) {
        // Check for Free Cam Toggle (F + C)
        if ((key === 'f' || key === 'c') && this.input.keys.f && this.input.keys.c) {
            if (this.freeCamera && !this.freeCamera.enabled) {
                this.freeCamera.enable();
                return;
            }
        }

        // Banner Placement Logic (Only in Free Cam)
        if (this.freeCamera && this.freeCamera.enabled) {
            // Edit Mode for Permanent Banners
            if (key === '5' || key === '6') {
                const idx = key === '5' ? 0 : 1;
                
                // If already selected, deselect and log
                if (this.selectedBannerIndex === idx) {
                    const banner = this.banners[idx];
                    const pos = banner.position;
                    const rot = banner.rotation;
                    const scale = banner.scale.x;
                    
                    console.log(`FINAL BANNER ${idx + 1}:
                    Position: { x: ${pos.x.toFixed(3)}, y: ${pos.y.toFixed(3)}, z: ${pos.z.toFixed(3)} }
                    Rotation: { x: ${rot.x.toFixed(3)}, y: ${rot.y.toFixed(3)}, z: ${rot.z.toFixed(3)} }
                    Scale: ${scale.toFixed(3)}`);
                    
                    this.selectedBannerIndex = -1;
                    this.wireframeBox.visible = false;
                } else {
                    // Select
                    this.selectedBannerIndex = idx;
                    this.wireframeBox.visible = true;
                    console.log(`Selected Banner ${idx + 1}. Use Y/H (Up/Down) and G/J (Left/Right). Press ${key} again to save.`);
                }
            }

            if (key === '1') {
                // Spawn Ghost
                if (!this.bannerGhost && this.bannerTexture) {
                    const aspect = this.bannerTexture.image.width / this.bannerTexture.image.height;
                    const geometry = new THREE.PlaneGeometry(aspect, 1);
                    const material = new THREE.MeshBasicMaterial({ 
                        map: this.bannerTexture, 
                        transparent: true, 
                        side: THREE.DoubleSide,
                        opacity: 0.7 
                    });
                    this.bannerGhost = new THREE.Mesh(geometry, material);
                    this.scene.threeScene.add(this.bannerGhost);
                    console.log("Banner Ghost Spawned. Press '2' to place, 'z'/'x' to scale.");
                }
            }
            if (key === '2') {
                // Place Ghost
                if (this.bannerGhost) {
                    this.bannerGhost.material.opacity = 1.0;
                    const pos = this.bannerGhost.position;
                    const rot = this.bannerGhost.rotation;
                    const scale = this.bannerGhost.scale;
                    
                    console.log(`PLACED BANNER:
                    Position: { x: ${pos.x.toFixed(3)}, y: ${pos.y.toFixed(3)}, z: ${pos.z.toFixed(3)} }
                    Rotation: { x: ${rot.x.toFixed(3)}, y: ${rot.y.toFixed(3)}, z: ${rot.z.toFixed(3)} }
                    Scale: ${scale.x.toFixed(3)}`);
                    
                    // Detach ghost so we can spawn a new one
                    this.bannerGhost = null; 
                }
            }
            if (key === '3') {
                // Clear All (Not tracking placed ones yet, just clear ghost for now or reload)
                // Since we don't store placed ones in a list in this simple implementation, 
                // we'll just remove the current ghost.
                if (this.bannerGhost) {
                    this.scene.threeScene.remove(this.bannerGhost);
                    this.bannerGhost = null;
                    console.log("Ghost Removed.");
                }
            }
            // Z/X scaling handled in update loop for continuous press or here for single press?
            // User said "can hold down", so update loop is better.
        }

        // If Map Editor is active, ignore game controls (except maybe toggle editor?)
        // Actually, MapEditor handles its own input, but we need to prevent 'r' from resetting car
        if (this.mapEditor && this.mapEditor.active) {
            return; 
        }

        if (key === 'p') this.resetCar(true);
        if (key === 'r') this.resetCar(false);
        if (key === '0') {
            // Fake Jump
            const dist = 10 + Math.random() * 90; // 10m to 100m
            if (this.hud) this.hud.addJump(dist);
        }
        if (key === 'l') {
            // Log Position for Checkpoint Setup
            if (this.vehicle) {
                const pos = this.vehicle.chassisBody.translation();
                console.log(`LOG POS: { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)} }`);
            }
        }
        if (key === 'b') {
            // Debug Log Y Positions
            if (this.vehicle) {
                const pos = this.vehicle.chassisBody.translation();
                console.log(`[DEBUG] Car Y: ${pos.y.toFixed(4)}`);
            }
            if (this.mapEditor) {
                console.log(`[DEBUG] Map Editor Objects:`);
                this.mapEditor.checkpoints.forEach((cp, i) => {
                    console.log(`  Checkpoint ${i}: Y=${cp.y.toFixed(4)}`);
                });
                this.mapEditor.ramps.forEach((r, i) => {
                    console.log(`  Ramp ${i}: Y=${r.pos.y.toFixed(4)}`);
                });
            }
        }
        if (key === 'v') {
            if (this.lapSystem) {
                this.lapSystem.toggleStartLineVisibility();
            }
        }
    }

    resetCar(toStart) {
        if (!this.vehicle) return;

        // Reset internal physics state (clears landing boost memory etc)
        this.vehicle.reset();

        const body = this.vehicle.chassisBody;
        
        // 1. Kill all velocity immediately
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);

        if (toStart) {
            // Reset to Start Position (High enough to drop safely)
            body.setTranslation({ x: 0, y: 3.0, z: 0 }, true);
            // Reset rotation to Face Backward (-Z)
            body.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true);
        } else {
            // Flip Upright at current position
            const t = body.translation();
            // Lift by 3 units to ensure we are clear of any geometry
            body.setTranslation({ x: t.x, y: t.y + 3.0, z: t.z }, true); 
            
            // Reset rotation to flat (keep heading)
            const currentRot = body.rotation();
            const q = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
            
            // Extract Forward Vector
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
            
            // Project to horizontal plane (XZ)
            forward.y = 0;
            if (forward.lengthSq() > 0.001) {
                forward.normalize();
                // Create new rotation looking in that direction
                const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
                body.setRotation({ x: targetQuat.x, y: targetQuat.y, z: targetQuat.z, w: targetQuat.w }, true);
            } else {
                // Fallback if perfectly vertical
                body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            }
        }
    }

    update() {
        // Always render scene (even when paused)
        if (this.scene) {
            // If Map Editor is active, use its camera
            if (this.mapEditor && this.mapEditor.active) {
                this.renderer.render(this.scene.threeScene, this.mapEditor.camera);
                this.mapEditor.update();
                return; // Skip game logic
            } 
            // If Free Camera is active, use it
            else if (this.freeCamera && this.freeCamera.enabled) {
                this.freeCamera.update(this.time.delta);
                
                // Update Banner Ghost if active
                if (this.bannerGhost) {
                    // Position: Distance scales with size so it stays in view
                    // Base distance 10.0 * scale
                    const dist = 10.0 * this.bannerScale;
                    const offset = new THREE.Vector3(0, 0, -dist).applyQuaternion(this.freeCamera.camera.quaternion);
                    this.bannerGhost.position.copy(this.freeCamera.camera.position).add(offset);
                    
                    // Rotation: Face camera (billboard)
                    this.bannerGhost.quaternion.copy(this.freeCamera.camera.quaternion);
                    
                    // Handle Scaling (Z/X)
                    if (this.input.keys.z) {
                        this.bannerScale = Math.max(0.1, this.bannerScale - 1.0 * this.time.delta);
                    }
                    if (this.input.keys.x) {
                        this.bannerScale += 1.0 * this.time.delta;
                    }
                    this.bannerGhost.scale.set(this.bannerScale, this.bannerScale, 1);
                }

                // Update Selected Banner Nudging
                if (this.selectedBannerIndex !== -1 && this.banners[this.selectedBannerIndex]) {
                    const banner = this.banners[this.selectedBannerIndex];
                    // Reduced speeds to 1/3 of previous values
                    const nudgeSpeed = (2.0 / 3.0) * this.time.delta; // Was 2.0
                    const rotSpeed = (1.0 / 3.0) * this.time.delta;   // Was 1.0

                    if (this.input.keys.shift) {
                        // Rotation Mode
                        // Y/H: Pitch (X-axis)
                        if (this.input.keys.y) banner.rotateX(-rotSpeed);
                        if (this.input.keys.h) banner.rotateX(rotSpeed);

                        // G/J: Yaw (Y-axis)
                        if (this.input.keys.g) banner.rotateY(-rotSpeed);
                        if (this.input.keys.j) banner.rotateY(rotSpeed);

                        // T/U: Roll (Z-axis)
                        if (this.input.keys.t) banner.rotateZ(-rotSpeed);
                        if (this.input.keys.u) banner.rotateZ(rotSpeed);
                    } else {
                        // Movement Mode
                        // Y/H: Up/Down (World Y)
                        if (this.input.keys.y) banner.position.y += nudgeSpeed;
                        if (this.input.keys.h) banner.position.y -= nudgeSpeed;

                        // G/J: Left/Right (Local X)
                        if (this.input.keys.g) banner.translateX(-nudgeSpeed);
                        if (this.input.keys.j) banner.translateX(nudgeSpeed);

                        // T/U: Forward/Backward (Local Z)
                        if (this.input.keys.t) banner.translateZ(nudgeSpeed);
                        if (this.input.keys.u) banner.translateZ(-nudgeSpeed);
                    }

                    // Update Wireframe
                    if (this.wireframeBox) {
                        this.wireframeBox.position.copy(banner.position);
                        this.wireframeBox.quaternion.copy(banner.quaternion);
                        this.wireframeBox.scale.copy(banner.scale);
                        // Adjust wireframe scale to match aspect ratio of banner
                        // Banner geometry is (aspect, 1), scaled by banner.scale
                        // Wireframe geometry is (aspect, 1, 0.2)
                        // So just copying scale works if geometries match base size
                        // But we created wireframe with fixed aspect earlier?
                        // Let's just recreate or scale wireframe geometry?
                        // Actually, we created wireframe with aspect in createPermanentBanners.
                        // Since both banners use same texture/aspect, it's fine.
                    }
                }

                this.renderer.render(this.scene.threeScene, this.freeCamera.camera);
            }
            else {
                this.renderer.render(this.scene.threeScene);
            }
        }

        if (this.paused) return;

        this.time.update();
        const dt = this.time.delta;
        
        // ESC to exit is handled by FreeCamera listening to pointerlockchange

        if (this.raceStarted) {
            this.raceTime += dt;
        }

        // 1. Input
        // If Free Cam is active, zero out car controls
        let controlState;
        if (this.freeCamera && this.freeCamera.enabled) {
            controlState = { throttle: 0, steering: 0, brake: 0 };
        } else {
            const rawInput = this.input.getControlState();
            controlState = rawInput;

            // If race hasn't started, remember the held input so it can be applied on GO
            if (!this.raceStarted) {
                this.preStartInput = rawInput;
                // Do not let the vehicle move before GO: zero controls
                controlState = { throttle: 0, steering: 0, brake: 0 };
            } else if (!this.prevRaceStarted && this.raceStarted) {
                // Race just started this frame: honor any held inputs captured during countdown
                controlState = this.preStartInput || rawInput;
            }
        }

        this.prevRaceStarted = this.raceStarted;

        // 2. Physics Step
        if (this.vehicle) {
            // console.log("Input:", controlState); // Debug Input
            this.vehicle.update(dt, controlState);
            this.physics.step(dt);
            
            // 3. Update State (Future Multiplayer Sync Point)
            this.localCarState.updateFromPhysics(this.vehicle);
        }

        // 4. Sync Visuals from State
        if (this.vehicle && this.visual) {
            // In a networked game, we might interpolate between states here.
            // For local, we just use the physics state directly.
            
            // Calculate drift power for visuals
            // Simple approximation: Angle between velocity and forward vector
            let driftPower = 0;
            let isDrifting = false;
            
            if (this.vehicle.controller) {
                const speed = this.vehicle.controller.currentVehicleSpeed();
                if (speed > 5) { // Only drift if moving
                    // We can check side slip from vehicle controller if available, 
                    // or just use input + speed as a proxy for now.
                    // Better: Use the vehicle controller's internal state if exposed.
                    // For now, let's use a simple heuristic: High speed + Steering = Drift?
                    // No, that's too simple.
                    // Let's assume the vehicle physics class handles the "drifting" state logic internally 
                    // or we just pass 0 for now until we hook up real slip angle.
                    
                    // Actually, let's use the side speed vs forward speed ratio
                    // But we don't have easy access to local velocity here without transforming.
                    // Let's just pass 0 for now, or maybe random for testing?
                    // User asked for particles "concise".
                    // Let's enable it if steering is hard at speed.
                    if (Math.abs(controlState.steering) > 0.5 && speed > 15) {
                        isDrifting = true;
                        driftPower = 1.0;
                    }
                }
            }

            this.visual.update(
                this.localCarState.position, 
                this.localCarState.rotation, 
                this.vehicle.controller,
                dt,
                isDrifting,
                driftPower
            );

            // 5. Camera Follow
            // Only update camera if Free Cam is NOT active
            if (!this.freeCamera || !this.freeCamera.enabled) {
                this.updateCamera(this.localCarState.position, this.localCarState.physicsRotation, dt);
            }
        }

        // 6. Update HUD
        if (this.hud && this.vehicle && this.vehicle.controller) {
            const speedMS = this.vehicle.controller.currentVehicleSpeed();
            const speedKMH = speedMS * 3.6;
            
            this.hud.update({
                speed: speedKMH,
                lap: this.lapSystem ? this.lapSystem.currentLap : 1,
                maxLaps: this.lapSystem ? this.lapSystem.totalLaps : 3,
                time: this.raceTime, // Use race timer instead of total app time
                position: 1, // Always 1st in single player
                fuel: 1.0, // Infinite fuel for now
                boost: 3, // Mock boost count
                playerPos: this.localCarState.position
            });
        }

        // 7. Update Lap System
        if (this.lapSystem) {
            this.lapSystem.update();
        }
    }

    updateCamera(carPos, carRot, dt) {
        // Simple Chase Camera
        // Calculate desired position based on car's backward vector
        const carQuat = carRot.clone();
        const offset = this.cameraOffset.clone().applyQuaternion(carQuat);
        const desiredPos = carPos.clone().add(offset);
        
        // Smoothly interpolate camera position
        this.renderer.camera.position.lerp(desiredPos, 5.0 * dt);
        
        // Look at car (plus a bit ahead)
        const lookTarget = carPos.clone().add(this.cameraLookAtOffset.clone().applyQuaternion(carQuat));
        this.renderer.camera.lookAt(lookTarget);
    }
}

const game = new Game();
game.init();