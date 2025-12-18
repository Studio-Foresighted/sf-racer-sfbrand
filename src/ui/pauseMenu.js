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
        // Check for mobile to display correct controls
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Create Overlay
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'pause-menu';
        this.uiContainer.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(5, 5, 5, 0.95);
            color: #ecf0f1;
            font-family: 'Orbitron', sans-serif;
            z-index: 3000;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            user-select: none;
            overflow-y: auto;
            padding: 20px;
            box-sizing: border-box;
        `;

        // --- MAIN MENU VIEW ---
        this.mainMenu = document.createElement('div');
        this.mainMenu.style.cssText = `
            display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 800px; margin: auto; position: relative;
        `;

        // Title
        const title = document.createElement('h1');
        title.innerText = 'PAUSED';
        title.style.cssText = isMobile ? `
            font-size: 2.5rem; margin: 0 0 15px 0; letter-spacing: 5px; text-shadow: 2px 2px 0px #000; color: #fff;
        ` : `
            font-size: 4rem; margin: 0 0 20px 0; letter-spacing: 10px; text-shadow: 4px 4px 0px #000; color: #fff;
        `;
        this.mainMenu.appendChild(title);

        // Content Row (Controls)
        const contentRow = document.createElement('div');
        contentRow.style.cssText = isMobile ? `
            display: flex; flex-direction: column; gap: 15px; align-items: stretch; margin-bottom: 20px; width: 100%;
        ` : `
            display: flex; flex-direction: row; gap: 20px; align-items: flex-start; margin-bottom: 30px;
        `;

        // Keybindings (Left)
        const keysContainer = document.createElement('div');
        keysContainer.style.cssText = `
            background: rgba(255,255,255,0.05); padding: 15px; border: 1px solid rgba(255,255,255,0.1); text-align: center;
        `;
        
        if (isMobile) {
             keysContainer.innerHTML = `
                <div style="display: flex; justify-content: space-around; align-items: flex-start; gap: 10px; width: 100%;">
                    <!-- Steer -->
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                        <div style="display: flex; gap: 5px;">
                            <div style="width: 40px; height: 40px; background: rgba(0,0,0,0.8); border-radius: 50%; position: relative; border: 1px solid rgba(255,255,255,0.2);">
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(90deg); width: 15px; height: 15px; background: url('./assets/ui/inner-arrow.png') no-repeat center; background-size: contain;"></div>
                            </div>
                            <div style="width: 40px; height: 40px; background: rgba(0,0,0,0.8); border-radius: 50%; position: relative; border: 1px solid rgba(255,255,255,0.2);">
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); width: 15px; height: 15px; background: url('./assets/ui/inner-arrow.png') no-repeat center; background-size: contain;"></div>
                            </div>
                        </div>
                        <span style="color: #888; font-size: 0.7rem;">STEER</span>
                    </div>
                    <!-- Gas -->
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                        <div style="width: 40px; height: 40px; background: rgba(0,200,0,0.3); border-radius: 8px; position: relative; border: 1px solid rgba(255,255,255,0.2);">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(180deg); width: 20px; height: 20px; background: url('./assets/ui/inner-arrow.png') no-repeat center; background-size: contain;"></div>
                        </div>
                        <span style="color: #888; font-size: 0.7rem;">GAS</span>
                    </div>
                    <!-- Brake -->
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                        <div style="width: 40px; height: 40px; background: rgba(200,0,0,0.3); border-radius: 8px; position: relative; border: 1px solid rgba(255,255,255,0.2);">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: url('./assets/ui/inner-arrow.png') no-repeat center; background-size: contain;"></div>
                        </div>
                        <span style="color: #888; font-size: 0.7rem;">REV</span>
                    </div>
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

        // Buttons Container
        const buttonsGrid = document.createElement('div');
        buttonsGrid.style.cssText = isMobile ? `
            display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;
        ` : `
            display: flex; flex-direction: column; align-items: center; gap: 10px;
        `;

        const btnStyle = isMobile ? `
            padding: 12px 5px; font-size: 0.9rem; background: rgba(241, 196, 15, 0.1); color: #f1c40f;
            border: 1px solid #f1c40f; font-family: inherit; cursor: pointer; text-transform: uppercase;
            letter-spacing: 1px; transition: all 0.2s; width: 100%;
        ` : `
            padding: 15px 40px; font-size: 1.2rem; background: transparent; color: #f1c40f;
            border: 2px solid #f1c40f; font-family: inherit; cursor: pointer; text-transform: uppercase;
            letter-spacing: 2px; margin: 10px; transition: all 0.2s; width: 250px;
        `;

        // Mobile Reset Buttons
        if (isMobile) {
            this.resetCarBtn = document.createElement('button');
            this.resetCarBtn.innerText = 'RESET CAR';
            this.resetCarBtn.style.cssText = btnStyle;
            this.resetCarBtn.onclick = () => {
                if (this.game.input && this.game.input.onKeyDownCallback) {
                    this.game.input.onKeyDownCallback('r');
                    this.toggle(); // Close menu
                }
            };
            buttonsGrid.appendChild(this.resetCarBtn);

            this.resetStartBtn = document.createElement('button');
            this.resetStartBtn.innerText = 'RESET START';
            this.resetStartBtn.style.cssText = btnStyle;
            this.resetStartBtn.onclick = () => {
                if (this.game.input && this.game.input.onKeyDownCallback) {
                    this.game.input.onKeyDownCallback('p');
                    this.toggle(); // Close menu
                }
            };
            buttonsGrid.appendChild(this.resetStartBtn);
        }

        // Race Again Button (Hidden by default, shown when race finished)
        this.raceAgainBtn = document.createElement('button');
        this.raceAgainBtn.innerText = 'RACE AGAIN';
        
        // Match HUD "Race Again" style
        this.raceAgainBtn.style.cssText = `
            padding: 15px 40px;
            font-size: 24px;
            font-weight: bold;
            background: linear-gradient(45deg, #ff00cc, #00ccff);
            border: none;
            color: white;
            cursor: pointer;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
            width: 100%;
            margin-top: 10px;
            text-transform: uppercase;
            font-family: inherit;
        `;
        
        this.raceAgainBtn.style.display = 'none';
        this.raceAgainBtn.onclick = () => {
            this.game.restartRace();
            this.toggle();
        };
        buttonsGrid.appendChild(this.raceAgainBtn);

        if (!isMobile) {
            const settingsBtn = document.createElement('button');
            settingsBtn.innerText = 'CAR SETTINGS';
            settingsBtn.style.cssText = btnStyle;
            settingsBtn.onclick = () => this.showSettings();
            buttonsGrid.appendChild(settingsBtn);

            const mapEditBtn = document.createElement('button');
            mapEditBtn.innerText = 'MAP EDITOR';
            mapEditBtn.style.cssText = btnStyle;
            mapEditBtn.onclick = () => {
                if (this.game.mapEditor) {
                    this.game.mapEditor.toggle();
                }
            };
            buttonsGrid.appendChild(mapEditBtn);
        }

        const resumeBtn = document.createElement('button');
        resumeBtn.innerText = 'RESUME';
        resumeBtn.style.cssText = btnStyle;
        if (isMobile) {
            // Hide Resume button on mobile as requested (using X button instead)
            resumeBtn.style.display = 'none';
        }
        resumeBtn.onclick = () => this.toggle();
        buttonsGrid.appendChild(resumeBtn);

        this.mainMenu.appendChild(buttonsGrid);
        this.uiContainer.appendChild(this.mainMenu);

        // --- SETTINGS MENU VIEW ---
        this.settingsMenu = document.createElement('div');
        this.settingsMenu.style.cssText = `
            display: none; flex-direction: column; align-items: center; width: 100%; max-width: 800px; margin: auto;
        `;

        const settingsTitle = document.createElement('h2');
        settingsTitle.innerText = 'TUNING';
        settingsTitle.style.cssText = isMobile ? `
            font-size: 1.5rem; margin-bottom: 15px; letter-spacing: 3px; color: #f1c40f;
        ` : `
            font-size: 2.5rem; margin-bottom: 20px; letter-spacing: 5px; color: #f1c40f;
        `;
        this.settingsMenu.appendChild(settingsTitle);

        // Settings Content Row (Split View)
        const settingsContent = document.createElement('div');
        settingsContent.style.cssText = isMobile ? `
            display: flex; flex-direction: column; gap: 15px; align-items: stretch; width: 100%; margin-bottom: 15px;
        ` : `
            display: flex; flex-direction: row; gap: 30px; align-items: flex-start; margin-bottom: 20px;
        `;

        // 1. Main Tuning Form (Left)
        const form = document.createElement('div');
        form.style.cssText = isMobile ? `
            background: rgba(0,0,0,0.5); padding: 15px; border: 1px solid #444;
            max-height: 40vh; overflow-y: auto; width: 100%; box-sizing: border-box;
        ` : `
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
            label.style.fontSize = isMobile ? '0.8rem' : '1rem';
            
            const valDisplay = document.createElement('span');
            valDisplay.innerText = p.defaultValue;
            valDisplay.style.color = '#f1c40f';
            valDisplay.style.fontSize = isMobile ? '0.8rem' : '1rem';
            
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
            input.style.accentColor = '#f1c40f';
            
            input.oninput = (e) => {
                const val = parseFloat(e.target.value);
                valDisplay.innerText = val.toFixed(2);
                this.updatePhysics(p.key, val);
                if (p.onChange) p.onChange(val);
            };

            if (!isMobile) {
                const desc = document.createElement('div');
                desc.innerText = p.desc;
                desc.style.fontSize = '0.8rem';
                desc.style.color = '#888';
                desc.style.marginTop = '2px';
                row.appendChild(desc);
            }

            row.appendChild(input);
            form.appendChild(row);
        });
        settingsContent.appendChild(form);

        // 2. Stop/Slow Mechanic Panel (Right)
        const stopSlowContainer = document.createElement('div');
        stopSlowContainer.style.cssText = isMobile ? `
            background: rgba(0,0,0,0.5); padding: 15px; border: 1px solid #444; text-align: left; width: 100%; box-sizing: border-box;
        ` : `
            background: rgba(0,0,0,0.5); padding: 20px; border: 1px solid #444; text-align: left; width: 300px;
        `;
        
        stopSlowContainer.innerHTML = `
            <div style="margin-bottom: 10px; color: #f1c40f; letter-spacing: 1px; text-align: center; font-size: 0.9rem;">COASTING BRAKE</div>
            
            <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: center;">
                <input type="checkbox" id="ss-enable" style="width: 20px; height: 20px; accent-color: #f1c40f; margin-right: 10px;">
                <label for="ss-enable" style="color: #ecf0f1; cursor: pointer; font-size: 0.9rem;">Enable</label>
            </div>

            <div style="margin-bottom: 5px; color: #ccc; font-size: 0.8rem;">Brake Force</div>
            <input type="range" id="ss-brake" min="0" max="0.2" step="0.01" value="0.03" style="width: 100%; accent-color: #f1c40f; margin-bottom: 10px;">
            
            <div style="margin-bottom: 5px; color: #ccc; font-size: 0.8rem;">Air Resistance</div>
            <input type="range" id="ss-drag" min="0" max="1.0" step="0.05" value="0.15" style="width: 100%; accent-color: #f1c40f; margin-bottom: 10px;">

            <button id="ss-apply" style="
                width: 100%; padding: 10px; background: #f1c40f; color: #000; border: none; 
                font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem;
            ">Apply Changes</button>
        `;
        settingsContent.appendChild(stopSlowContainer);

        this.settingsMenu.appendChild(settingsContent);

        const backBtn = document.createElement('button');
        backBtn.innerText = 'BACK';
        backBtn.style.cssText = btnStyle;
        if (isMobile) {
            backBtn.style.width = '100%';
            backBtn.style.marginTop = '10px';
        }
        backBtn.onclick = () => this.showMain();
        this.settingsMenu.appendChild(backBtn);

        this.uiContainer.appendChild(this.settingsMenu);
        document.body.appendChild(this.uiContainer);
        
        this.bindApplyLogic();
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
            this.updateButtons();
            this.loadCurrentValues();
        }
    }

    updateButtons() {
        const isFinished = this.game.isRaceFinished;

        if (this.resetCarBtn) this.resetCarBtn.style.display = isFinished ? 'none' : 'block';
        if (this.resetStartBtn) this.resetStartBtn.style.display = isFinished ? 'none' : 'block';
        
        if (this.raceAgainBtn) {
            this.raceAgainBtn.style.display = isFinished ? 'block' : 'none';
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

    bindApplyLogic() {
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
    }
}
