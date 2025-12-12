import * as THREE from 'three';

export class FreeCamera {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.enabled = false;
        
        this.moveSpeed = 10.0;
        this.fastMultiplier = 3.0;
        this.lookSpeed = 0.002;
        
        this.keys = {
            w: false, a: false, s: false, d: false,
            q: false, e: false, // Up/Down (Q/E)
            n: false, m: false, // Up/Down (N/M) - Absolute Y
            shift: false
        };
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.euler.setFromQuaternion(camera.quaternion);
        
        this.setupInput();
        
        // Listen for pointer lock changes to handle ESC key
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement !== this.domElement) {
                this.enabled = false;
            }
        });
    }
    
    setupInput() {
        // We'll hook into global events but only process when enabled
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }
    
    onKeyDown(e) {
        if (!this.enabled) return;
        
        switch(e.key.toLowerCase()) {
            case 'w': this.keys.w = true; break;
            case 'a': this.keys.a = true; break;
            case 's': this.keys.s = true; break;
            case 'd': this.keys.d = true; break;
            case 'q': this.keys.q = true; break;
            case 'e': this.keys.e = true; break;
            case 'n': this.keys.n = true; break;
            case 'm': this.keys.m = true; break;
            case 'shift': this.keys.shift = true; break;
        }
    }
    
    onKeyUp(e) {
        if (!this.enabled) return;
        
        switch(e.key.toLowerCase()) {
            case 'w': this.keys.w = false; break;
            case 'a': this.keys.a = false; break;
            case 's': this.keys.s = false; break;
            case 'd': this.keys.d = false; break;
            case 'q': this.keys.q = false; break;
            case 'e': this.keys.e = false; break;
            case 'n': this.keys.n = false; break;
            case 'm': this.keys.m = false; break;
            case 'shift': this.keys.shift = false; break;
        }
    }
    
    onMouseMove(e) {
        if (!this.enabled) return;
        // Only rotate if pointer is locked or mouse button held? 
        // For simplicity, let's require right mouse button or just always if enabled?
        // Usually free cam implies pointer lock or right click drag.
        // Let's use right click drag for now to avoid locking issues if not requested.
        // Or better: When enabled, we capture mouse movement.
        
        if (document.pointerLockElement === this.domElement) {
            this.euler.y -= e.movementX * this.lookSpeed;
            this.euler.x -= e.movementY * this.lookSpeed;
            this.euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.euler.x));
            this.camera.quaternion.setFromEuler(this.euler);
        }
    }
    
    enable() {
        this.enabled = true;
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.domElement.requestPointerLock();
    }
    
    disable() {
        this.enabled = false;
        document.exitPointerLock();
    }
    
    update(dt) {
        if (!this.enabled) return;
        
        const speed = this.moveSpeed * (this.keys.shift ? this.fastMultiplier : 1.0) * dt;
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0);
        
        // Flatten movement vectors for WASD to be "FPS style" (optional, but usually preferred)
        // Actually, free cam usually flies in look direction.
        
        if (this.keys.w) this.camera.position.add(forward.multiplyScalar(speed));
        if (this.keys.s) this.camera.position.add(forward.multiplyScalar(-speed));
        if (this.keys.d) this.camera.position.add(right.multiplyScalar(speed));
        if (this.keys.a) this.camera.position.add(right.multiplyScalar(-speed));
        if (this.keys.e) this.camera.position.add(up.multiplyScalar(speed));
        if (this.keys.q) this.camera.position.add(up.multiplyScalar(-speed));
        
        // Absolute Y movement
        if (this.keys.n) this.camera.position.y += speed;
        if (this.keys.m) this.camera.position.y -= speed;
    }
}