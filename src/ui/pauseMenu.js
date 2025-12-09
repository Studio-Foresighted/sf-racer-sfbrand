export class PauseMenu {
    constructor(game) {
        this.game = game;
        this.visible = false;
        this.uiContainer = null;
        
        // User-friendly parameter mapping
        this.params = [
            { 
                key: 'suspensionStiffness', 
                label: 'Suspension Hardness', 
                desc: 'How hard the springs are. Higher = stiffer ride, less body roll.',
                min: 10, max: 200, defaultValue: 40.0
            },
            { 
                key: 'suspensionDamping', 
                label: 'Bounce Control', 
                desc: 'How quickly the car stops bouncing after a bump. Higher = less bounce.',
                min: 0.1, max: 10, defaultValue: 2.5
            },
            { 
                key: 'suspensionRestLength', 
                label: 'Ride Height', 
                desc: 'Distance from wheel to body. Higher = taller car (monster truck).',
                min: 0.1, max: 1.0, defaultValue: 0.3
            },
            { 
                key: 'friction', 
                label: 'Tire Grip', 
                desc: 'Forward traction. Higher = faster acceleration, less wheel spin.',
                min: 0.5, max: 5.0, defaultValue: 2.5
            },
            { 
                key: 'sideFriction', 
                label: 'Drift Control', 
                desc: 'Sideways grip. Lower = more drifting. Higher = stuck to road (can flip).',
                min: 0.5, max: 5.0, defaultValue: 2.0
            },
            { 
                key: 'antiRollStiffness', 
                label: 'Corner Stability', 
                desc: 'Force that keeps car level in turns. Higher = flat cornering, less flipping.',
                min: 0, max: 50000, defaultValue: 10000.0
            },
            { 
                key: 'maxSteerAngle', 
                label: 'Turning Sharpness', 
                desc: 'How far the wheels turn. Higher = tighter circles.',
                min: 0.1, max: 1.0, defaultValue: 0.7
            },
            { 
                key: 'maxEngineForce', 
                label: 'Engine Power', 
                desc: 'Force applied to wheels. Higher = faster accel.',
                min: 1000, max: 30000, defaultValue: 15000
            },
            { 
                key: 'topSpeed', 
                label: 'Top Speed (km/h)', 
                desc: 'Maximum speed limiter.',
                min: 50, max: 300, defaultValue: 120
            },
            {
                key: 'coinHeight',
                label: 'Coin Height Offset',
                desc: 'Adjust vertical position of coins.',
                min: -2.0, max: 2.0, defaultValue: -0.5,
                onChange: (val) => this.updateCoinHeight(val)
            }
        ];

        this.initUI();
        this.setupEvents();
    }

    updateCoinHeight(val) {
        if (this.game && this.game.scene && this.game.scene.threeScene) {
            this.game.scene.threeScene.traverse((child) => {
                if (child.name.toLowerCase().includes('coin')) {
                    // We need to store original Y to offset from it, or just assume relative moves?
                    // Better: Store original Y in userData if not present
                    if (child.userData.originalY === undefined) {
                        child.userData.originalY = child.position.y + 0.5; // Undo the initial -0.5
                    }
                    child.position.y = child.userData.originalY + val;
                }
            });
        }
    }

    initUI() {
        // Create Overlay
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'pause-menu';
        this.uiContainer.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(5, 5, 5, 0.9);
            color: #ecf0f1;
            font-family: 'Courier New', Courier, monospace;
            z-index: 1000;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            user-select: none;
        `;

        // --- MAIN MENU VIEW ---
        this.mainMenu = document.createElement('div');
        this.mainMenu.style.cssText = `
            display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; justify-content: center; position: relative;
        `;

        // Title
        const title = document.createElement('h1');
        title.innerText = 'PAUSED';
        title.style.cssText = `
            font-size: 4rem; margin: 0 0 20px 0; letter-spacing: 10px; text-shadow: 4px 4px 0px #000; color: #fff;
        `;
        this.mainMenu.appendChild(title);

        // Content Row (Controls)
        const contentRow = document.createElement('div');
        contentRow.style.cssText = `
            display: flex; flex-direction: row; gap: 20px; align-items: flex-start; margin-bottom: 30px;
        `;

        // Keybindings (Left)
        const keysContainer = document.createElement('div');
        keysContainer.style.cssText = `
            background: rgba(0,0,0,0.5); padding: 20px; border: 1px solid #444; text-align: center; height: 100%;
        `;
        
        // Check for mobile to display correct controls
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isMobile) {
             keysContainer.innerHTML = `
                <div style="margin-bottom: 10px; color: #f1c40f; letter-spacing: 2px;">CONTROLS</div>
                <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; text-align: left; font-size: 1.1rem;">
                    <span style="color: #888;">ARROWS</span> <span>STEER LEFT / RIGHT</span>
                    <span style="color: #888;">GAS</span> <span>ACCELERATE</span>
                    <span style="color: #888;">REV</span> <span>BRAKE / REVERSE</span>
                </div>
            `;
        } else {
            keysContainer.innerHTML = `
                <div style="margin-bottom: 10px; color: #f1c40f; letter-spacing: 2px;">CONTROLS</div>
                <div style="display: grid; grid-template-columns: 100px 1fr; gap: 10px; text-align: left; font-size: 1.1rem;">
                    <span style="color: #888;">WASD</span> <span>FORWARD / BACK / STEER</span>
                    <span style="color: #888;">SPACE</span> <span>BRAKE</span>
                    <span style="color: #888;">R</span> <span>RESET CAR</span>
                    <span style="color: #888;">P</span> <span>RESET TO START</span>
                </div>
            `;
        }
        contentRow.appendChild(keysContainer);
        
        this.mainMenu.appendChild(contentRow);

        // Buttons
        const btnStyle = `
            padding: 15px 40px; font-size: 1.2rem; background: transparent; color: #f1c40f;
            border: 2px solid #f1c40f; font-family: inherit; cursor: pointer; text-transform: uppercase;
            letter-spacing: 2px; margin: 10px; transition: all 0.2s; width: 250px;
        `;

        // Mobile Reset Buttons
        if (isMobile) {
            const resetCarBtn = document.createElement('button');
            resetCarBtn.innerText = 'RESET CAR';
            resetCarBtn.style.cssText = btnStyle;
            resetCarBtn.onmouseover = () => { resetCarBtn.style.background = '#f1c40f'; resetCarBtn.style.color = '#000'; };
            resetCarBtn.onmouseout = () => { resetCarBtn.style.background = 'transparent'; resetCarBtn.style.color = '#f1c40f'; };
            resetCarBtn.onclick = () => {
                if (this.game.input && this.game.input.onKeyDownCallback) {
                    this.game.input.onKeyDownCallback('r');
                    this.toggle(); // Close menu
                }
            };
            this.mainMenu.appendChild(resetCarBtn);

            const resetStartBtn = document.createElement('button');
            resetStartBtn.innerText = 'RESET TO START';
            resetStartBtn.style.cssText = btnStyle;
            resetStartBtn.onmouseover = () => { resetStartBtn.style.background = '#f1c40f'; resetStartBtn.style.color = '#000'; };
            resetStartBtn.onmouseout = () => { resetStartBtn.style.background = 'transparent'; resetStartBtn.style.color = '#f1c40f'; };
            resetStartBtn.onclick = () => {
                if (this.game.input && this.game.input.onKeyDownCallback) {
                    this.game.input.onKeyDownCallback('p');
                    this.toggle(); // Close menu
                }
            };
            this.mainMenu.appendChild(resetStartBtn);
        }

        const settingsBtn = document.createElement('button');
        settingsBtn.innerText = 'CAR SETTINGS';
        settingsBtn.style.cssText = btnStyle;
        settingsBtn.onmouseover = () => { settingsBtn.style.background = '#f1c40f'; settingsBtn.style.color = '#000'; };
        settingsBtn.onmouseout = () => { settingsBtn.style.background = 'transparent'; settingsBtn.style.color = '#f1c40f'; };
        settingsBtn.onclick = () => this.showSettings();
        this.mainMenu.appendChild(settingsBtn);

        const mapEditBtn = document.createElement('button');
        mapEditBtn.innerText = 'MAP EDITOR';
        mapEditBtn.style.cssText = btnStyle;
        mapEditBtn.onmouseover = () => { mapEditBtn.style.background = '#f1c40f'; mapEditBtn.style.color = '#000'; };
        mapEditBtn.onmouseout = () => { mapEditBtn.style.background = 'transparent'; mapEditBtn.style.color = '#f1c40f'; };
        mapEditBtn.onclick = () => {
            if (this.game.mapEditor) {
                this.game.mapEditor.toggle();
            }
        };
        // add spacing beneath controls box to separate from CAR SETTINGS
        mapEditBtn.style.marginBottom = '26px';
        this.mainMenu.appendChild(mapEditBtn);

        const resumeBtn = document.createElement('button');
        resumeBtn.innerText = 'RESUME';
        resumeBtn.style.cssText = btnStyle;
        resumeBtn.onmouseover = () => { resumeBtn.style.background = '#f1c40f'; resumeBtn.style.color = '#000'; };
        resumeBtn.onmouseout = () => { resumeBtn.style.background = 'transparent'; resumeBtn.style.color = '#f1c40f'; };
        resumeBtn.onclick = () => this.toggle();
        this.mainMenu.appendChild(resumeBtn);

        // Tutorial overlays removed per user request (no garage/dashboard arrows)

        this.uiContainer.appendChild(this.mainMenu);

        // --- SETTINGS MENU VIEW ---
        this.settingsMenu = document.createElement('div');
        this.settingsMenu.style.cssText = `
            display: none; flex-direction: column; align-items: center; width: 100%; height: 100%; justify-content: center;
        `;

        const settingsTitle = document.createElement('h2');
        settingsTitle.innerText = 'TUNING & SETTINGS';
        settingsTitle.style.cssText = `
            font-size: 2.5rem; margin-bottom: 20px; letter-spacing: 5px; color: #f1c40f;
        `;
        this.settingsMenu.appendChild(settingsTitle);

        // Font Toggle
        const fontRow = document.createElement('div');
        fontRow.style.cssText = 'display: flex; align-items: center; margin-bottom: 20px; gap: 10px;';
        
        const fontLabel = document.createElement('span');
        fontLabel.innerText = 'UI Font Style:';
        fontLabel.style.color = '#ccc';
        
        const fontSelect = document.createElement('select');
        fontSelect.style.cssText = 'padding: 5px; background: #333; color: white; border: 1px solid #555;';
        fontSelect.innerHTML = `
            <option value="italic" selected>Orbitron Italic</option>
            <option value="normal">Orbitron Normal</option>
        `;
        fontSelect.onchange = (e) => {
            if (e.target.value === 'italic') {
                document.body.classList.add('font-italic');
            } else {
                document.body.classList.remove('font-italic');
            }
        };
        
        fontRow.appendChild(fontLabel);
        fontRow.appendChild(fontSelect);
        this.settingsMenu.appendChild(fontRow);

        // Floating Points Font Size control
        const floatRow = document.createElement('div');
        floatRow.style.cssText = 'display: flex; align-items: center; margin-bottom: 20px; gap: 10px;';

        const floatLabel = document.createElement('span');
        floatLabel.innerText = 'Floating Points Size:';
        floatLabel.style.color = '#ccc';

        const floatInput = document.createElement('input');
        floatInput.type = 'range';
        floatInput.min = 12;
        floatInput.max = 96;
        floatInput.step = 1;
        floatInput.value = (this.game && this.game.hud && this.game.hud.floatingFontSize) ? this.game.hud.floatingFontSize : 48;
        floatInput.style.width = '200px';
        floatInput.oninput = (e) => {
            const v = parseInt(e.target.value, 10);
            if (this.game && this.game.hud) {
                this.game.hud.floatingFontSize = v;
            }
        };

        const floatVal = document.createElement('span');
        floatVal.innerText = floatInput.value;
        floatVal.style.color = '#f1c40f';

        floatInput.oninput = (e) => {
            const v = parseInt(e.target.value, 10);
            floatVal.innerText = String(v);
            if (this.game && this.game.hud) this.game.hud.floatingFontSize = v;
        };

        floatRow.appendChild(floatLabel);
        floatRow.appendChild(floatInput);
        floatRow.appendChild(floatVal);
        this.settingsMenu.appendChild(floatRow);

        // Settings Content Row (Split View)
        const settingsContent = document.createElement('div');
        settingsContent.style.cssText = `
            display: flex; flex-direction: row; gap: 30px; align-items: flex-start; margin-bottom: 20px;
        `;

        // 1. Main Tuning Form (Left)
        const form = document.createElement('div');
        form.style.cssText = `
            background: rgba(0,0,0,0.5); padding: 20px; border: 1px solid #444;
            max-height: 60vh; overflow-y: auto; width: 500px;
        `;

        this.params.forEach(p => {
            const row = document.createElement('div');
            row.style.marginBottom = '15px';
            
            const labelRow = document.createElement('div');
            labelRow.style.display = 'flex';
            labelRow.style.justifyContent = 'space-between';
            labelRow.style.marginBottom = '5px';
            
            const label = document.createElement('label');
            label.innerText = p.label;
            label.style.color = '#ecf0f1';
            label.style.fontWeight = 'bold';
            
            const valDisplay = document.createElement('span');
            valDisplay.innerText = p.defaultValue;
            valDisplay.style.color = '#f1c40f';
            
            labelRow.appendChild(label);
            labelRow.appendChild(valDisplay);
            row.appendChild(labelRow);

            const input = document.createElement('input');
            input.type = 'range';
            input.id = `input-${p.key}`;
            input.min = p.min;
            input.max = p.max;
            input.step = (p.max - p.min) / 100;
            input.value = p.defaultValue;
            input.style.width = '100%';
            input.style.accentColor = '#f1c40f'; // Modern browser support
            
            input.oninput = (e) => {
                const val = parseFloat(e.target.value);
                valDisplay.innerText = val.toFixed(2);
                this.updatePhysics(p.key, val);
                if (p.onChange) p.onChange(val);
            };

            const desc = document.createElement('div');
            desc.innerText = p.desc;
            desc.style.fontSize = '0.8rem';
            desc.style.color = '#888';
            desc.style.marginTop = '2px';

            row.appendChild(input);
            row.appendChild(desc);
            form.appendChild(row);
        });
        settingsContent.appendChild(form);

        // 2. Stop/Slow Mechanic Panel (Right) - Re-added here
        const stopSlowContainer = document.createElement('div');
        stopSlowContainer.style.cssText = `
            background: rgba(0,0,0,0.5); padding: 20px; border: 1px solid #444; text-align: left; width: 300px;
        `;
        
        stopSlowContainer.innerHTML = `
            <div style="margin-bottom: 15px; color: #f1c40f; letter-spacing: 2px; text-align: center;">STOP / SLOW MECHANIC</div>
            
            <div style="margin-bottom: 10px; display: flex; align-items: center;">
                <input type="checkbox" id="ss-enable" style="width: 20px; height: 20px; accent-color: #f1c40f; margin-right: 10px;">
                <label for="ss-enable" style="color: #ecf0f1; cursor: pointer;">Enable Coasting Brake</label>
            </div>

            <div style="margin-bottom: 5px; color: #ccc; font-size: 0.9rem;">Brake Force (Coasting)</div>
            <input type="range" id="ss-brake" min="0" max="0.2" step="0.01" value="0.03" style="width: 100%; accent-color: #f1c40f; margin-bottom: 10px;">
            
            <div style="margin-bottom: 5px; color: #ccc; font-size: 0.9rem;">Air Resistance (Drag)</div>
            <input type="range" id="ss-drag" min="0" max="1.0" step="0.05" value="0.15" style="width: 100%; accent-color: #f1c40f; margin-bottom: 15px;">

            <button id="ss-apply" style="
                width: 100%; padding: 8px; background: #f1c40f; color: #000; border: none; 
                font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;
            ">Apply Changes</button>
        `;
        settingsContent.appendChild(stopSlowContainer);

        this.settingsMenu.appendChild(settingsContent);

        // Bind Apply Button Logic
        setTimeout(() => {
            const btn = document.getElementById('ss-apply');
            if (btn) {
                btn.onclick = () => {
                    const enabled = document.getElementById('ss-enable').checked;
                    const brakeVal = parseFloat(document.getElementById('ss-brake').value);
                    const dragVal = parseFloat(document.getElementById('ss-drag').value);
                    
                    const newTuning = {
                        coastingBrakeFactor: enabled ? brakeVal : 0,
                        linearDamping: dragVal
                    };
                    
                    if (this.game.vehicle) {
                        this.game.vehicle.updateTuning(newTuning);
                        
                        // Visual Feedback
                        btn.innerText = "APPLIED!";
                        btn.style.background = "#2ecc71";
                        setTimeout(() => {
                            btn.innerText = "APPLY CHANGES";
                            btn.style.background = "#f1c40f";
                        }, 1000);
                    }
                };
            }
        }, 0);

        const backBtn = document.createElement('button');
        backBtn.innerText = 'BACK';
        backBtn.style.cssText = btnStyle;
        backBtn.onmouseover = () => { backBtn.style.background = '#f1c40f'; backBtn.style.color = '#000'; };
        backBtn.onmouseout = () => { backBtn.style.background = 'transparent'; backBtn.style.color = '#f1c40f'; };
        backBtn.onclick = () => this.showMain();
        this.settingsMenu.appendChild(backBtn);

        this.uiContainer.appendChild(this.settingsMenu);
        document.body.appendChild(this.uiContainer);
    }

    setupEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Don't toggle if garage preview is open
                if (this.game.garage && this.game.garage.isPreviewOpen()) return;
                this.toggle();
            }
        });
    }

    updatePhysics(key, value) {
        if (this.game.vehicle) {
            this.game.vehicle.updateTuning({ [key]: value });
        }
    }

    toggle() {
        // Prevent toggling if game hasn't started or vehicle isn't ready
        if (!this.game.vehicle) return;

        this.visible = !this.visible;
        this.uiContainer.style.display = this.visible ? 'flex' : 'none';
        this.game.paused = this.visible;

        // Toggle Garage UI visibility
        if (this.game.garage && this.game.garage.ui) {
            this.game.garage.ui.style.display = this.visible ? 'none' : 'block';
        }

        // Update Mobile Menu Button
        const menuBtn = document.getElementById('mobile-menu-btn');
        if (menuBtn) {
            const span = menuBtn.querySelector('span');
            if (this.visible) {
                menuBtn.classList.add('menu-open');
                if (span) span.textContent = '✕';
            } else {
                menuBtn.classList.remove('menu-open');
                if (span) span.textContent = 'Menu';
            }
        }

        if (this.visible) {
            this.loadCurrentValues();
        }
    }

    loadCurrentValues() {
        const tuning = this.game.vehicle ? this.game.vehicle.tuning : {};
        
        this.params.forEach(p => {
            const input = document.getElementById(`input-${p.key}`);
            if (input) {
                // Use vehicle tuning if available, otherwise fallback to default
                const val = (tuning[p.key] !== undefined) ? tuning[p.key] : p.defaultValue;
                input.value = val;
            }
        });
    }

    applySettings() {
        if (!this.game.vehicle) return;
        
        const newTuning = {};
        this.params.forEach(p => {
            const input = document.getElementById(`input-${p.key}`);
            if (input) {
                newTuning[p.key] = parseFloat(input.value);
            }
        });

        this.game.vehicle.updateTuning(newTuning);
        
        // Visual feedback
        const btn = document.querySelector('button'); // Hacky, but works for now
        // alert("Settings Applied!"); // Too intrusive
    }

    resetDefaults() {
        if (this.game.vehicle) {
            this.game.vehicle.resetTuning();
        }
        // Reload values (will pick up defaults if vehicle reset worked, or static defaults if no vehicle)
        this.loadCurrentValues();
    }

    showSettings() {
        this.mainMenu.style.display = 'none';
        this.settingsMenu.style.display = 'flex';
    }

    showMain() {
        this.settingsMenu.style.display = 'none';
        this.mainMenu.style.display = 'flex';
    }
}