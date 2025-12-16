export class HUD {
    constructor(game) {
        this.game = game;
        
        // Elements
        this.layer = document.getElementById('hud-layer');
        this.controlsLayer = document.getElementById('controls-layer');
        
        this.rankText = this.layer.querySelector('.rank-text');
        this.lapDisplay = document.getElementById('lap-display');
        this.timeDisplay = document.getElementById('time-display');
        
        this.speedDisplay = document.getElementById('speed-display');
        this.speedBar = document.getElementById('speed-bar').querySelector('.bar-fill');
        this.fuelBar = document.getElementById('fuel-bar').querySelector('.bar-fill');
        this.nitroBars = Array.from(document.querySelectorAll('.nitro-bar'));
        
        // State
        this.trackBounds = null;
        this.floatingFontSize = 48; // px, default for +XX floating points
    }

    show() {
        this.layer.style.display = 'block';
        this.controlsLayer.style.display = 'block';
    }

    showCountdown(onComplete) {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.fontFamily = "'Poppins', sans-serif";
        overlay.style.fontSize = '120px';
        overlay.style.fontWeight = '900';
        overlay.style.color = '#fff';
        overlay.style.textShadow = '0 0 20px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.5)';
        overlay.style.zIndex = '2000';
        overlay.style.pointerEvents = 'none';
        document.body.appendChild(overlay);

        const steps = ['3', '2', '1', 'GO!'];
        let index = 0;

        const playStep = () => {
            if (index >= steps.length) {
                document.body.removeChild(overlay);
                // onComplete moved to 'GO' step
                return;
            }

            overlay.innerText = steps[index];
            overlay.style.opacity = '0';
            overlay.style.transform = 'translate(-50%, -50%) scale(0.5)';
            
            // Trigger "GO" logic slightly earlier (when '1' disappears / 'GO' appears)
            if (index === steps.length - 1) {
                if (onComplete) onComplete();
            }

            // Animate in
            overlay.animate([
                { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' },
                { opacity: 1, transform: 'translate(-50%, -50%) scale(1.2)', offset: 0.2 },
                { opacity: 1, transform: 'translate(-50%, -50%) scale(1.0)', offset: 0.8 },
                { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' }
            ], {
                duration: 1000,
                easing: 'ease-out'
            });

            index++;
            setTimeout(playStep, 1000);
        };

        playStep();
    }

    showFinish(onRestart) {
        if (this.finishOverlay) {
            document.body.removeChild(this.finishOverlay);
            this.finishOverlay = null;
        }

        const overlay = document.createElement('div');
        this.finishOverlay = overlay;
        overlay.style.position = 'absolute';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.textAlign = 'center';
        overlay.style.zIndex = '2000';
        overlay.style.fontFamily = "'Orbitron', sans-serif";
        
        const title = document.createElement('div');
        title.innerText = 'FINISHED';
        title.style.fontSize = '80px';
        title.style.fontWeight = '900';
        title.style.color = '#fff';
        title.style.textShadow = '0 0 20px #ff00cc, 0 0 40px #00ccff';
        title.style.marginBottom = '20px';
        title.style.opacity = '0';
        title.style.transform = 'scale(0.5)';
        title.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        const btn = document.createElement('button');
        btn.innerText = 'RACE AGAIN';
        btn.style.padding = '15px 40px';
        btn.style.fontSize = '24px';
        btn.style.fontWeight = 'bold';
        btn.style.background = 'linear-gradient(45deg, #ff00cc, #00ccff)';
        btn.style.border = 'none';
        btn.style.color = 'white';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';
        btn.style.opacity = '0';
        btn.style.transform = 'translateY(20px)';
        btn.style.transition = 'all 0.5s ease 0.3s'; // Delay button
        
        btn.onclick = () => {
            this.hideFinish();
            if (onRestart) onRestart();
        };
        
        overlay.appendChild(title);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);
        
        // Trigger Animation
        requestAnimationFrame(() => {
            title.style.opacity = '1';
            title.style.transform = 'scale(1)';
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
        });
    }

    hideFinish() {
        if (this.finishOverlay) {
            if (this.finishOverlay.parentNode) {
                this.finishOverlay.parentNode.removeChild(this.finishOverlay);
            }
            this.finishOverlay = null;
        }
    }

    hide() {
        this.layer.style.display = 'none';
        this.controlsLayer.style.display = 'none';
    }

    update(data) {
        // Speed
        this.speedDisplay.innerText = Math.floor(Math.abs(data.speed));
        // Speed Bar (0-200 km/h range for visual)
        const speedPercent = Math.min(Math.abs(data.speed) / 200 * 100, 100);
        this.speedBar.style.width = `${speedPercent}%`;
        
        // Lap
        this.lapDisplay.innerText = `LAP ${data.lap}/${data.maxLaps}`;
        
        // Time
        this.timeDisplay.innerText = this.formatTime(data.time);
        
        // Rank replaced by coin counter; do not overwrite here
        
        // Fuel/Boost (Mocked or Real)
        if (data.fuel !== undefined) this.fuelBar.style.width = `${data.fuel * 100}%`;
        if (data.boost !== undefined) {
            this.nitroBars.forEach((bar, i) => {
                if (i < data.boost) bar.classList.add('active');
                else bar.classList.remove('active');
            });
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds * 100) % 100);
        return `${this.pad(m)}' ${this.pad(s)}" ${this.pad(ms)}`;
    }

    // Backwards-compatible helper used by LapSystem
    updateLap(current, total) {
        if (this.lapDisplay) {
            this.lapDisplay.innerText = `LAP ${current}/${total}`;
        }
    }
    // Backwards-compatible coin collector called by LapSystem
    collectCoin(amount = 1) {
        // Prefer the big coin counter in the top-left (`#coin-count`), fallback to created element
        let span = document.getElementById('coin-count');
        if (!span && this.coinCounter) span = this.coinCounter.querySelector('span');

        let count = 0;
        if (span) {
            count = parseInt(span.innerText || '0', 10);
        } else {
            // create fallback in top-left if missing
            if (this.rankText) {
                this.rankText.innerHTML = '🪙 <span id="coin-count">0</span>';
                span = document.getElementById('coin-count');
            }
            if (span) count = parseInt(span.innerText || '0', 10);
        }

        // Award points
        count += amount;

        if (span) span.innerText = String(count);

        // Update Game State & Milestones
        if (this.game) {
            this.game.coins = count;
            if (this.game.milestones) {
                this.game.milestones.updateCoins(count);
            }
        }

        this.animateCoin(span, amount);
    }

    resetCoins() {
        let span = document.getElementById('coin-count');
        if (span) {
            span.innerText = '0';
        }
        if (this.game) {
            this.game.coins = 0;
        }
    }

    // Animate the visible coin element (either rankText or coinCounter)
    animateCoin(span, amount) {
        const animEl = span ? span.parentElement : this.coinCounter;
        if (animEl) {
            animEl.style.transition = 'transform 150ms ease';
            animEl.style.transform = 'scale(1.15)';
            setTimeout(() => { animEl.style.transform = 'scale(1)'; }, 150);
        }

        // Show floating points above car when coins are collected
        if (this.game && this.game.vehicle) {
            const pos = this.game.vehicle.getPosition();
            if (pos) {
                const p = pos.clone(); p.y += 2.0;
                this.showFloatingPoints(amount, p);
            }
        }
    }

    pad(n) { return n < 10 ? '0' + n : n; }
    
    getSuffix(n) {
        if (n === 1) return 'ST';
        if (n === 2) return 'ND';
        if (n === 3) return 'RD';
        return 'TH';
    }

    // Jump UI: store and render top jumps
    addJump(distance) {
        if (!this.topJumps) this.topJumps = [];
        const id = Date.now() + Math.random();
        this.topJumps.push({ id, distance });
        this.topJumps.sort((a, b) => b.distance - a.distance);
        if (this.topJumps.length > 3) this.topJumps = this.topJumps.slice(0, 3);
        this.renderJumpList(id);
    }

    renderJumpList(newId) {
        // Ensure container exists and attach it under the top-right HUD so it appears under the speed bar
        if (!this.jumpList) {
            this.jumpList = document.getElementById('jump-list');
            if (!this.jumpList) {
                const parent = document.getElementById('hud-top-right') || document.body;
                this.jumpList = document.createElement('div');
                this.jumpList.id = 'jump-list';
                // place it visually under existing elements in the top-right
                this.jumpList.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; pointer-events: none; margin-top: 8px;';
                parent.appendChild(this.jumpList);
            }
            // Inject jump styles if not present
            if (!document.getElementById('hud-jump-styles')) {
                const style = document.createElement('style');
                style.id = 'hud-jump-styles';
                style.innerHTML = `
                    .jump-entry { font-family: Orbitron, sans-serif; font-size: 20px; font-weight: bold; color: white; margin-bottom: 6px; background: rgba(0,0,0,0.6); padding: 6px 12px; border-right: 4px solid #555; display:flex; gap:12px; align-items:center; min-width:140px; justify-content:space-between; }
                    .jump-entry.gold { color: #ffd700; border-right-color: #ffd700; }
                    .jump-entry.silver { color: #e0e0e0; border-right-color: #e0e0e0; }
                    .jump-entry.bronze { color: #cd7f32; border-right-color: #cd7f32; }
                    @keyframes jumpPop { 0% { transform: translateX(100%) scale(0.9); opacity:0 } 100% { transform: translateX(0) scale(1); opacity:1 } }
                `;
                document.head.appendChild(style);
            }
        }

        this.jumpList.innerHTML = '';
        this.topJumps.forEach((jump, index) => {
            const entry = document.createElement('div');
            entry.className = 'jump-entry';
            let prefix = `#${index + 1}`;
            if (index === 0) { entry.classList.add('gold'); prefix = '👑'; }
            else if (index === 1) entry.classList.add('silver');
            else if (index === 2) entry.classList.add('bronze');

            entry.innerHTML = `<span>${prefix}</span><span>${jump.distance.toFixed(1)} m</span>`;

            if (jump.id === newId) {
                entry.style.animation = 'jumpPop 0.4s ease-out forwards';
            }

            this.jumpList.appendChild(entry);
        });
    }

    showFloatingPoints(points, position) {
        if (!this.game || !this.game.renderer || !this.game.renderer.camera) return;

        const vector = position.clone();
        vector.project(this.game.renderer.camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

        const el = document.createElement('div');
        el.innerText = `+${points}`;
        el.style.position = 'absolute';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = 'translate(-50%, -50%)';
        el.style.color = '#ffd700';
        el.style.fontFamily = "'Orbitron', sans-serif";
        el.style.fontSize = `${this.floatingFontSize}px`;
        el.style.fontWeight = '900';
        el.style.textShadow = '2px 2px 0 #000, 0 0 20px rgba(255, 215, 0, 0.5)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '2000';
        document.body.appendChild(el);

        // Animate
        const anim = el.animate([
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' },
            { opacity: 1, transform: 'translate(-50%, -150%) scale(1.2)', offset: 0.2 },
            { opacity: 1, transform: 'translate(-50%, -200%) scale(1.0)', offset: 0.8 },
            { opacity: 0, transform: 'translate(-50%, -250%) scale(0.8)' }
        ], {
            duration: 1500,
            easing: 'ease-out'
        });

        anim.onfinish = () => el.remove();
    }
}