export class InputController {
    constructor(onKeyDown) {
        this.keys = {
            w: false, a: false, s: false, d: false,
            arrowup: false, arrowdown: false, arrowleft: false, arrowright: false,
            space: false, shift: false,
            f: false, c: false,
            z: false, x: false,
            y: false, h: false, g: false, j: false,
            t: false, u: false,
            1: false, 2: false, 3: false, 5: false, 6: false
        };
        this.onKeyDownCallback = onKeyDown;

        // Touch State
        this.touchState = {
            steering: 0, // -1 to 1
            throttle: 0, // -1 to 1
            brake: 0,    // 0 or 1
            nitro: false
        };

        // Steering Logic
        this.steeringPointerId = null;
        this.steeringStartX = 0;
        this.maxSteerPixels = 100; // Pixels to slide for full steer

        // Accelerate Logic
        this.acceleratePointers = new Set();

        this.initKeyboard();
        this.initTouch();
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup', (e) => this.onKey(e, false));
    }

    initTouch() {
        // Steering Buttons
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        
        // Helper to handle steering state
        const updateSteering = () => {
            let val = 0;
            if (this.leftPressed) val += 1; // Left is positive in my logic
            if (this.rightPressed) val -= 1; // Right is negative
            this.touchState.steering = val;
        };

        if (btnLeft) {
            const startLeft = (e) => {
                this.leftPressed = true;
                btnLeft.classList.add('active');
                updateSteering();
                e.preventDefault();
            };
            const endLeft = (e) => {
                this.leftPressed = false;
                btnLeft.classList.remove('active');
                updateSteering();
            };
            btnLeft.addEventListener('pointerdown', startLeft);
            btnLeft.addEventListener('pointerup', endLeft);
            btnLeft.addEventListener('pointercancel', endLeft);
            btnLeft.addEventListener('pointerleave', endLeft);
        }

        if (btnRight) {
            const startRight = (e) => {
                this.rightPressed = true;
                btnRight.classList.add('active');
                updateSteering();
                e.preventDefault();
            };
            const endRight = (e) => {
                this.rightPressed = false;
                btnRight.classList.remove('active');
                updateSteering();
            };
            btnRight.addEventListener('pointerdown', startRight);
            btnRight.addEventListener('pointerup', endRight);
            btnRight.addEventListener('pointercancel', endRight);
            btnRight.addEventListener('pointerleave', endRight);
        }

        // Accelerate Button
        const btnGas = document.getElementById('btn-accelerate');
        if (btnGas) {
            const addGas = (e) => {
                this.acceleratePointers.add(e.pointerId);
                this.touchState.throttle = 1;
                btnGas.classList.add('active');
                e.preventDefault();
            };
            const removeGas = (e) => {
                this.acceleratePointers.delete(e.pointerId);
                if (this.acceleratePointers.size === 0) {
                    this.touchState.throttle = 0;
                    btnGas.classList.remove('active');
                }
            };
            
            btnGas.addEventListener('pointerdown', addGas);
            btnGas.addEventListener('pointerup', removeGas);
            btnGas.addEventListener('pointercancel', removeGas);
            btnGas.addEventListener('pointerleave', removeGas);
        }

        // Brake Button (Now Reverse/Brake like 'S' key)
        const btnBrake = document.getElementById('btn-brake');
        if (btnBrake) {
            const addBrake = (e) => {
                // Instead of just brake, we set throttle to -1 (Reverse/Brake)
                this.touchState.throttle = -1;
                btnBrake.classList.add('active');
                e.preventDefault();
            };
            const removeBrake = (e) => {
                // Reset throttle if it was negative
                if (this.touchState.throttle < 0) {
                    this.touchState.throttle = 0;
                }
                btnBrake.classList.remove('active');
            };
            
            btnBrake.addEventListener('pointerdown', addBrake);
            btnBrake.addEventListener('pointerup', removeBrake);
            btnBrake.addEventListener('pointercancel', removeBrake);
            btnBrake.addEventListener('pointerleave', removeBrake);
        }

        // Mobile Menu Button
        const menuBtn = document.getElementById('mobile-menu-btn');
        
        if (menuBtn) {
            // Show it if touch is supported (simple check)
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                menuBtn.style.display = 'block';
            }
            
            menuBtn.addEventListener('click', (e) => {
                // Simulate ESC key
                const event = new KeyboardEvent('keydown', { key: 'Escape' });
                window.dispatchEvent(event);
            });
        }

            // Nitro Button
            const btnNitro = document.getElementById('btn-nitro');
            if (btnNitro) {
                btnNitro.addEventListener('pointerdown', (e) => {
                    this.touchState.nitro = true;
                    btnNitro.classList.add('active');
                    if (this.onKeyDownCallback) this.onKeyDownCallback('shift'); // Trigger boost logic
                });
                const endNitro = (e) => {
                    this.touchState.nitro = false;
                    btnNitro.classList.remove('active');
                };
                btnNitro.addEventListener('pointerup', endNitro);
                btnNitro.addEventListener('pointercancel', endNitro);
                btnNitro.addEventListener('pointerleave', endNitro);
            }
        }

    onKey(e, isDown) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = isDown;
        }
        // Handle numbers 1, 2, 3, 5, 6
        if (key === '1') this.keys['1'] = isDown;
        if (key === '2') this.keys['2'] = isDown;
        if (key === '3') this.keys['3'] = isDown;
        if (key === '5') this.keys['5'] = isDown;
        if (key === '6') this.keys['6'] = isDown;

        if (key === ' ') this.keys.space = isDown;
        if (e.key === 'Shift') this.keys.shift = isDown;

        if (isDown && this.onKeyDownCallback) {
            this.onKeyDownCallback(key);
        }
    }

    getControlState() {
        // Combine Keyboard and Touch
        const kForward = this.keys.w || this.keys.arrowup;
        const kBackward = this.keys.s || this.keys.arrowdown;
        const kLeft = this.keys.a || this.keys.arrowleft;
        const kRight = this.keys.d || this.keys.arrowright;
        const kBrake = this.keys.space;

        let throttle = this.touchState.throttle;
        if (throttle === 0) {
            if (kForward) throttle += 1;
            if (kBackward) throttle -= 1;
        }

        let steering = this.touchState.steering;
        if (steering === 0) {
            if (kLeft) steering += 1;
            if (kRight) steering -= 1;
        }

        let brake = this.touchState.brake;
        if (brake === 0) {
            brake = kBrake ? 1 : 0;
        }

        return {
            throttle, // -1 to 1
            steering, // -1 (right) to 1 (left)
            brake
        };
    }
}