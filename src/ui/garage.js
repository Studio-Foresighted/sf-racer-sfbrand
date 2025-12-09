import * as THREE from 'three';

export class GarageUI {
    constructor(game, carLoader, onSelect) {
        this.game = game;
        this.loader = carLoader;
        this.onSelect = onSelect;
        this.ui = document.getElementById('garage-ui');
        this.list = document.getElementById('car-list');
        this.previewContainer = null;
        this.previewRenderer = null;
        this.previewScene = null;
        this.previewCamera = null;
        this.previewModel = null;
        this.animId = null;
    }

    async init() {
        const manifest = await this.loader.loadManifest();
        console.log("Garage Manifest:", manifest);
        
        this.ui.style.display = 'block';
        
        // Setup Collapsible Header
        const header = document.getElementById('garage-header');
        const list = document.getElementById('car-list');
        const toggleIcon = document.getElementById('garage-toggle-icon');
        
        // Default Collapsed State
        if (list) list.style.display = 'none';
        if (toggleIcon) toggleIcon.textContent = '▶';
        this.ui.classList.add('collapsed');

        if (header) {
            header.onclick = () => {
                if (list.style.display === 'none') {
                    // Expand
                    list.style.display = 'block';
                    toggleIcon.textContent = '▼';
                    this.ui.classList.remove('collapsed');
                } else {
                    // Collapse
                    list.style.display = 'none';
                    toggleIcon.textContent = '▶';
                    this.ui.classList.add('collapsed');
                }
            };
        }
        
        // Hide loading overlay if it's still up
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';

        if (!manifest || manifest.length === 0) {
            this.list.innerHTML = '<div style="padding:10px; color:#ff5555;">No cars found in manifest.</div>';
            return;
        }

        manifest.forEach(car => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.marginBottom = '5px';

            const btn = document.createElement('div');
            btn.className = 'car-btn';
            btn.textContent = car.displayName;
            btn.style.marginBottom = '0'; // Override default
            btn.style.flex = '1';
            btn.onclick = () => {
                // Highlight
                document.querySelectorAll('.car-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.onSelect(car.id);
            };

            const eyeBtn = document.createElement('button');
            eyeBtn.innerHTML = '3D';
            eyeBtn.style.cssText = `
                background: #444; border: 1px solid #555; color: white;
                cursor: pointer; width: 40px; margin-left: 5px;
                font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 12px;
                text-shadow: 1px 1px 0 #000;
                display: flex; align-items: center; justify-content: center;
            `;
            eyeBtn.onclick = (e) => {
                e.stopPropagation();
                // Collapse UI before opening preview
                if (list && list.style.display !== 'none') {
                    list.style.display = 'none';
                    if (toggleIcon) toggleIcon.textContent = '▶';
                    this.ui.classList.add('collapsed');
                }
                this.openFullscreenPreview(car.id);
            };

            row.appendChild(btn);
            row.appendChild(eyeBtn);
            this.list.appendChild(row);
        });

        // Select first by default
        if (manifest.length > 0) {
            // Find the first car button in the first row
            const firstBtn = this.list.children[0].querySelector('.car-btn');
            if (firstBtn) firstBtn.click();
        }
    }

    isPreviewOpen() {
        return !!this.previewContainer;
    }

    async openFullscreenPreview(carId) {
        this.game.paused = true;

        // Create Container
        this.previewContainer = document.createElement('div');
        this.previewContainer.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #111; z-index: 2000; display: flex; flex-direction: column;
        `;

        // Hide Garage UI during preview
        if (this.ui) {
            this.ui.style.display = 'none';
        }

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px; background: #222; display: flex; justify-content: flex-end;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'CLOSE (ESC)';
        closeBtn.style.cssText = 'padding: 8px 20px; background: #d00; color: white; border: none; cursor: pointer; font-weight: bold;';
        closeBtn.onclick = () => this.closeFullscreenPreview();
        
        header.appendChild(closeBtn);
        this.previewContainer.appendChild(header);
        document.body.appendChild(this.previewContainer);

        // Setup Three.js
        this.previewScene = new THREE.Scene();
        this.previewScene.background = new THREE.Color(0x222222);
        
        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.previewScene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(5, 10, 7);
        this.previewScene.add(dirLight);

        // Camera
        const aspect = window.innerWidth / (window.innerHeight - 50); // Minus header
        this.previewCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        this.previewCamera.position.set(0, 1.5, 4.5);
        this.previewCamera.lookAt(0, 0.5, 0);

        // Renderer
        this.previewRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.previewRenderer.setSize(window.innerWidth, window.innerHeight - 50);
        this.previewContainer.appendChild(this.previewRenderer.domElement);

        // Load Model
        const model = await this.loader.loadCarModel(carId);
        if (model) {
            this.previewModel = model;
            // Center it visually
            this.previewModel.position.set(0, 0, 0);
            this.previewScene.add(this.previewModel);
        }

        // Interaction State
        let isDragging = false;
        let prevX = 0;
        let prevY = 0;
        let autoSpin = true;
        let pinchStartDist = 0;
        let zoomStart = 0;

        // Mouse Events
        const canvas = this.previewRenderer.domElement;
        
        // --- MOUSE ---
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            autoSpin = false;
            prevX = e.clientX;
            prevY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging && this.previewModel) {
                const deltaX = e.clientX - prevX;
                const deltaY = e.clientY - prevY;
                
                this.previewModel.rotation.y += deltaX * 0.01;
                this.previewModel.rotation.x += deltaY * 0.01;
                
                prevX = e.clientX;
                prevY = e.clientY;
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                autoSpin = true;
            }
        });

        // --- TOUCH ---
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                isDragging = true;
                autoSpin = false;
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Pinch Zoom Start
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDist = Math.sqrt(dx*dx + dy*dy);
                zoomStart = this.previewCamera.position.z;
                autoSpin = false;
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging && this.previewModel) {
                const deltaX = e.touches[0].clientX - prevX;
                const deltaY = e.touches[0].clientY - prevY;
                
                this.previewModel.rotation.y += deltaX * 0.01;
                this.previewModel.rotation.x += deltaY * 0.01;
                
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Pinch Zoom Move
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const scale = pinchStartDist / dist;
                this.previewCamera.position.z = Math.max(2.0, Math.min(10.0, zoomStart * scale));
            }
        });

        canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                isDragging = false;
                autoSpin = true;
            }
        });

        // Zoom (Wheel)
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            // Zoom in/out by moving camera Z
            this.previewCamera.position.z += e.deltaY * 0.005;
            // Clamp zoom
            this.previewCamera.position.z = Math.max(2.0, Math.min(10.0, this.previewCamera.position.z));
        });

        // Animation Loop
        const animate = () => {
            if (!this.previewContainer) return; // Stopped
            
            if (this.previewModel && autoSpin) {
                this.previewModel.rotation.y += 0.0025; // 0.01 * 0.25 = 0.0025 (0.75 slower means 0.25 speed? Or 0.75 OF the speed? "0.75 slower" usually means 25% speed or speed - 0.75*speed. Let's assume 25% of original speed which was 0.01. So 0.0025.)
                // Wait, "0.75 slower" could mean 1 - 0.75 = 0.25 speed.
                // Or it could mean speed * 0.75.
                // "0.75 slower" is ambiguous. I'll assume 25% of original speed (0.0025) for a nice slow spin.
            }
            
            this.previewRenderer.render(this.previewScene, this.previewCamera);
            this.animId = requestAnimationFrame(animate);
        };
        animate();

        // ESC to close
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation(); // Stop bubbling to PauseMenu
                this.closeFullscreenPreview();
            }
        };
        window.addEventListener('keydown', this.escHandler, true); // Capture phase to ensure we get it first
    }

    closeFullscreenPreview() {
        if (!this.previewContainer) return;

        // Cleanup
        // Remove the capturing keydown handler (was added with capture=true)
        window.removeEventListener('keydown', this.escHandler, true);
        cancelAnimationFrame(this.animId);
        
        if (this.previewRenderer) {
            this.previewRenderer.dispose();
        }
        
        document.body.removeChild(this.previewContainer);
        this.previewContainer = null;
        this.previewScene = null;
        this.previewRenderer = null;
        this.previewModel = null;

        // Restore Garage UI
        if (this.ui) {
            this.ui.style.display = 'block';
        }

        // Resume Game
        this.game.paused = false;
    }
}