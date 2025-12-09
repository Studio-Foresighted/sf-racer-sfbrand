import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class VehiclePhysics {
    constructor(physicsWorld, startPos) {
        this.world = physicsWorld.world;
        this.controller = null;
        this.chassisBody = null;
        
        // ==================================================
        // TUNING PARAMETERS (Exact Copy from threejs_car_physics)
        // ==================================================
        this.tuning = {
            // Chassis
            chassisMass: 200,
            
            // COM Hack: In Rapier, we can't set ROLL_INFLUENCE.
            // Instead, we offset the Collider UP relative to the Body Origin (COM).
            // This puts the COM effectively BELOW the car, acting like a pendulum.
            // Collider Offset Y: +0.5m
            // Wheel Attachment Y: +0.3m (Relative to COM)
            // Result: COM is 0.3m below the axles. Very stable.
            colliderOffset: { x: 0, y: 0.5, z: 0 },
            wheelAttachmentY: 0.3,
            
            // Suspension
            suspensionStiffness: 50,
            suspensionDamping: 10,
            suspensionCompression: 4.0,
            suspensionRestLength: 0.3,
            maxSuspensionTravel: 0.45, // 0.3 * 1.5
            
            // Grip / Friction
            frictionSlip: 10, // Exact match
            
            // Steering
            maxSteerAngle: 0.4, // ~23 degrees
            minSteerAngle: 0.15, // ~8 degrees at speed
            steeringSpeed: 1.5,
            steeringReturnSpeed: 2.0,

            // Engine / Brakes
            maxEngineForce: 1000, // Exact match
            maxBrakeForce: 70,    // Increased from 50 to compensate for bias
            reverseForce: 500,    // Exact match
            idleBrakeForce: 20,   // Exact match
            
            // Damping (Air resistance)
            linearDamping: 0.15, // Default
            angularDamping: 0.5, // Default
        };

        this.currentSteeringAngle = 0;

        this.createChassis(startPos);
        this.createVehicleController();
        
        this.wasGrounded = true;
        this.landingGraceTimer = 0;
        this.flipTimer = 0;
        
        // Jump Measurement
        this.jumpStartPos = new THREE.Vector3();
        this.onJumpCallback = null;
    }

    createChassis(pos) {
        // 1. Create RigidBody
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setLinearDamping(this.tuning.linearDamping)
            .setAngularDamping(this.tuning.angularDamping)
            .setCanSleep(false);
        
        this.chassisBody = this.world.createRigidBody(rigidBodyDesc);

        // 2. Create Collider
        // Dimensions: 2.0 x 0.6 x 4.0 (Box)
        // Half-extents: 1.0, 0.3, 2.0
        // threejs_car_physics uses 0.8 height factor -> 0.24
        // threejs_car_physics uses 0.9 length factor -> 1.8
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1.0, 0.24, 1.8)
            .setTranslation(
                this.tuning.colliderOffset.x, 
                this.tuning.colliderOffset.y, 
                this.tuning.colliderOffset.z
            ) 
            .setMass(this.tuning.chassisMass)
            .setFriction(0.1); 
        
        this.world.createCollider(colliderDesc, this.chassisBody);
    }

    createVehicleController() {
        this.controller = this.world.createVehicleController(this.chassisBody);

        // Wheel Configuration
        const wheelRadius = 0.4;
        const wheelDir = new RAPIER.Vector3(0, -1, 0);
        const wheelAxle = new RAPIER.Vector3(-1, 0, 0); 
        
        // Wheel Offsets
        const xOff = 0.8; 
        const zOff = 1.5;
        const yOff = this.tuning.wheelAttachmentY;

        // Add 4 Wheels
        // Front: +Z, Back: -Z
        
        // Front Left (0)
        this.addWheel({ x: -xOff, y: yOff, z: zOff }, wheelRadius, wheelDir, wheelAxle); // FL
        this.addWheel({ x: xOff, y: yOff, z: zOff }, wheelRadius, wheelDir, wheelAxle); // FR
        this.addWheel({ x: -xOff, y: yOff, z: -zOff }, wheelRadius, wheelDir, wheelAxle); // BL
        this.addWheel({ x: xOff, y: yOff, z: -zOff }, wheelRadius, wheelDir, wheelAxle); // BR
    }

    addWheel(pos, radius, dir, axle) {
        this.controller.addWheel(pos, dir, axle, this.tuning.suspensionRestLength, radius);
        const i = this.controller.numWheels() - 1;
        
        // Apply Initial Tuning
        this.controller.setWheelSuspensionStiffness(i, this.tuning.suspensionStiffness);
        this.controller.setWheelMaxSuspensionTravel(i, this.tuning.maxSuspensionTravel);
        this.controller.setWheelSuspensionCompression(i, this.tuning.suspensionCompression);
        this.controller.setWheelSuspensionRelaxation(i, this.tuning.suspensionDamping);
        this.controller.setWheelFrictionSlip(i, this.tuning.frictionSlip);
    }

    update(dt, input) {
        if (!this.controller) return;

        // Update Timers
        if (this.landingGraceTimer > 0) {
            this.landingGraceTimer -= dt;
        }

        // console.log("Vehicle Update. Throttle:", input.throttle, "Brake:", input.brake);

        const speed = this.controller.currentVehicleSpeed(); // m/s
        const speedKmh = Math.abs(speed) * 3.6;
        
        // ==================================================
        // 1. STEERING (Ported Logic)
        // ==================================================
        // Calculate dynamic maximum steering angle based on speed
        // MIN_SPEED = 0, MAX_SPEED = 150
        // MIN_ANGLE = 0.15, MAX_ANGLE = 0.4
        const MIN_SPEED = 0;
        const MAX_SPEED = 150;
        const MIN_ANGLE = this.tuning.minSteerAngle;
        const MAX_ANGLE = this.tuning.maxSteerAngle;
        
        const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speedKmh));
        const speedFactor = (clampedSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
        const maxSteeringAngle = MAX_ANGLE - speedFactor * (MAX_ANGLE - MIN_ANGLE);
        
        // Calculate target steering angle based on input
        // input.steering is -1 (right) to 1 (left)
        // We want positive angle for Left?
        // Rapier/Ammo usually: positive steering = turn left (if Y up, -Z forward)
        let targetSteeringAngle = input.steering * maxSteeringAngle;
        
        // Determine appropriate steering speed
        // If returning to 0 or reversing direction -> Return Speed
        const isReturning = (targetSteeringAngle === 0 || 
                            (this.currentSteeringAngle > 0 && targetSteeringAngle < 0) || 
                            (this.currentSteeringAngle < 0 && targetSteeringAngle > 0));
                            
        const steerSpeed = isReturning ? this.tuning.steeringReturnSpeed : this.tuning.steeringSpeed;
        
        // Smoothly interpolate
        const steeringDelta = targetSteeringAngle - this.currentSteeringAngle;
        const maxSteeringDelta = steerSpeed * dt;
        
        if (Math.abs(steeringDelta) > maxSteeringDelta) {
            this.currentSteeringAngle += Math.sign(steeringDelta) * maxSteeringDelta;
        } else {
            this.currentSteeringAngle = targetSteeringAngle;
        }
        
        // Apply to front wheels (0 and 1)
        this.controller.setWheelSteering(0, this.currentSteeringAngle);
        this.controller.setWheelSteering(1, this.currentSteeringAngle);

        // ==================================================
        // 2. ENGINE & BRAKES (Ported Logic)
        // ==================================================
        let engineForce = 0;
        let brakeForce = 0;

        // Check if grounded (any wheel touching)
        let isGrounded = false;
        const numWheels = this.controller.numWheels();
        for (let i = 0; i < numWheels; i++) {
            if (this.controller.wheelIsInContact(i)) {
                isGrounded = true;
                break;
            }
        }

        // Jump Measurement Logic (Preserved)
        if (!this.wasGrounded && isGrounded) {
            // Landed
            this.landingGraceTimer = 0.5; // 500ms grace period
            
            const landPos = this.getPosition();
            const dist = Math.sqrt(
                Math.pow(landPos.x - this.jumpStartPos.x, 2) + 
                Math.pow(landPos.z - this.jumpStartPos.z, 2)
            );
            
            // Restore Damping
            this.chassisBody.setAngularDamping(this.tuning.angularDamping);
            this.chassisBody.setLinearDamping(this.tuning.linearDamping);
            
            if (dist > 10.0 && this.onJumpCallback) {
                this.onJumpCallback(dist);
            }
        } else if (this.wasGrounded && !isGrounded) {
            // Takeoff
            const pos = this.getPosition();
            this.jumpStartPos.set(pos.x, pos.y, pos.z);

            // PHYSICS JUMP BOOST
            // If taking off with upward momentum (ramp) and high speed, apply a forward boost
            // to make the car fly further (arcade physics).
            const vel = this.chassisBody.linvel();
            const speed = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
            const speedKmh = speed * 3.6;
            
            // Thresholds: Moving up (ramp) and fast enough
            if (vel.y > 1.0 && speedKmh > 60) {
                // Calculate Boost Impulse
                // We want to increase velocity by ~30% to get a "long jump" feel
                const boostMult = 0.35; 
                
                // Apply impulse (Mass * DeltaV)
                // Boost Forward (X/Z) and slightly less Up (Y) to avoid moon gravity feel
                this.chassisBody.applyImpulse({
                    x: vel.x * this.tuning.chassisMass * boostMult,
                    y: vel.y * this.tuning.chassisMass * boostMult * 0.5, 
                    z: vel.z * this.tuning.chassisMass * boostMult
                }, true);
                
                // Reduce angular damping in air to let it fly smoother
                this.chassisBody.setAngularDamping(0.1);
                
                // Reduce linear damping to minimize air resistance (fly further)
                this.chassisBody.setLinearDamping(0.01);
            }
        }
        this.wasGrounded = isGrounded;

        // Get forward direction
        const rot = this.chassisBody.rotation();
        const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q); // +Z forward to match wheels
        
        // Get velocity
        const vel = this.chassisBody.linvel();
        const velVec = new THREE.Vector3(vel.x, vel.y, vel.z);
        
        const dotForward = fwd.dot(velVec);
        
        // Input mapping
        // input.throttle: >0 (W), <0 (S)
        // input.brake: Spacebar
        
        if (input.throttle > 0) {
            // W pressed: Accelerate forward
            engineForce = this.tuning.maxEngineForce;
            
            // Low Speed Boost (Fake physics for better gameplay)
            // 0-100 km/h: Apply multiplier
            if (speedKmh < 100) {
                // Linear boost from 2.5x at 0 speed to 1.0x at 100 speed
                const boostFactor = 2.5 - (speedKmh / 100) * 1.5;
                engineForce *= boostFactor;
            }
            
            brakeForce = 0;
        } else if (input.throttle < 0) {
            // S pressed
            // Fix: Check dotForward against a small positive threshold to detect forward motion
            // But if we are stopped (speed ~0), dotForward is unreliable.
            // Use speed check instead for more robustness.
            
            if (dotForward > 0.1 && speedKmh > 1.0) {
                // Moving forward significantly - apply brakes
                engineForce = 0;
                brakeForce = this.tuning.maxBrakeForce;
            } else {
                // Stopped or moving backward - apply reverse
                engineForce = -this.tuning.reverseForce;
                brakeForce = 0;
            }
        } else {
            // No key pressed
            engineForce = 0;
            brakeForce = 2; // Reduced from 20 to allow better coasting
        }
        
        // Manual brake override (Spacebar)
        if (input.brake) {
            brakeForce = this.tuning.maxBrakeForce;
            engineForce = 0;
        }

        // Grace Period Override: If just landed and holding throttle, disable braking/drag
        if (this.landingGraceTimer > 0 && input.throttle > 0) {
            brakeForce = 0;
            // Also temporarily reduce damping to prevent impact slowdown
            this.chassisBody.setLinearDamping(0);
        } else {
            // FAKE BRAKES: If braking, use high linear damping instead of wheel torque
            // This prevents the car from flipping forward due to the pendulum effect
            if (brakeForce > 10) {
                // Apply massive drag to stop the car "in air" (fake physics)
                this.chassisBody.setLinearDamping(5.0); // Very strong drag
                
                // Apply minimal brake torque just to stop wheels visually
                brakeForce = 5; 
            } else {
                // Restore normal damping (unless we are in mid-air)
                // If airborne, use low damping to fly further (arcade feel)
                if (!isGrounded) {
                     this.chassisBody.setLinearDamping(0.05);
                } else {
                    this.chassisBody.setLinearDamping(this.tuning.linearDamping);
                }
            }
        }

        // Apply forces
        // Engine to rear wheels (2 and 3)
        this.controller.setWheelEngineForce(2, engineForce);
        this.controller.setWheelEngineForce(3, engineForce);
        
        // Brakes to all wheels
        // Apply Brake Bias: Front wheels (0,1) get 50% force, Rear wheels (2,3) get 100% force
        // This prevents the car from flipping forward (nose-dive) during hard braking
        for (let i = 0; i < 4; i++) {
            this.controller.setWheelBrake(i, brakeForce);
        }
        
        // Step the vehicle controller
        this.controller.updateVehicle(dt);

        // ==================================================
        // 3. AUTO-RESET (Flip Detection)
        // ==================================================
        const checkRot = this.chassisBody.rotation();
        const checkQ = new THREE.Quaternion(checkRot.x, checkRot.y, checkRot.z, checkRot.w);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(checkQ);
        
        // If Up vector is pointing down (y < 0.5 means tilted > 60 degrees)
        if (up.y < 0.5) {
            this.flipTimer += dt;
            if (this.flipTimer > 2.0) {
                this.reset(false); // Flip upright
                this.flipTimer = 0;
            }
        } else {
            this.flipTimer = 0;
        }
    }

    getPosition() {
        const t = this.chassisBody.translation();
        return new THREE.Vector3(t.x, t.y, t.z);
    }

    getRotation() {
        const r = this.chassisBody.rotation();
        return new THREE.Quaternion(r.x, r.y, r.z, r.w);
    }
    
    // Helper for UI Tuning
    updateTuning(newValues) {
        this.tuning = { ...this.tuning, ...newValues };
        // Re-apply wheel params
        for (let i = 0; i < this.controller.numWheels(); i++) {
            this.controller.setWheelSuspensionStiffness(i, this.tuning.suspensionStiffness);
            this.controller.setWheelSuspensionRelaxation(i, this.tuning.suspensionDamping);
            this.controller.setWheelFrictionSlip(i, this.tuning.frictionSlip);
        }
        // Re-apply body params
        this.chassisBody.setLinearDamping(this.tuning.linearDamping);
        this.chassisBody.setAngularDamping(this.tuning.angularDamping);
    }
    
    resetTuning() {
        // Reset logic would go here
    }

    reset(toStart = false) {
        this.wasGrounded = true;
        this.currentSteeringAngle = 0;
        this.flipTimer = 0;
        
        if (this.controller) {
            for (let i = 0; i < 4; i++) {
                this.controller.setWheelEngineForce(i, 0);
                this.controller.setWheelBrake(i, 0);
                this.controller.setWheelSteering(i, 0);
            }
        }

        // Physics Reset Logic (Ported from main.js resetCar)
        const body = this.chassisBody;
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);

        if (toStart) {
            // Reset to Start Position (High enough to drop safely)
            body.setTranslation({ x: 0, y: 3.0, z: 0 }, true);
            body.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true);
        } else {
            // Flip Upright at current position
            const t = body.translation();
            body.setTranslation({ x: t.x, y: t.y + 2.0, z: t.z }, true); 
            
            // Reset rotation to flat (keep heading)
            const currentRot = body.rotation();
            const q = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
            
            // Extract Forward Vector
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q); // +Z forward
            
            // Project to horizontal plane (XZ)
            forward.y = 0;
            if (forward.lengthSq() > 0.001) {
                forward.normalize();
                // Create new rotation looking in that direction
                const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
                body.setRotation({ x: targetQuat.x, y: targetQuat.y, z: targetQuat.z, w: targetQuat.w }, true);
            } else {
                body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            }
        }
    }
}
