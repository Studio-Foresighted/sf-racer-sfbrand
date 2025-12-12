export class MilestoneSystem {
    constructor(game) {
        this.game = game;
        this.milestones = [];
        this.currentCoins = 0;
        this.lastSeenCount = 0; // Track viewed milestones
        
        // UI Elements
        this.btn = document.getElementById('gift-btn');
        this.notification = document.getElementById('gift-notification');
        this.modal = document.getElementById('milestone-modal');
        this.list = document.getElementById('milestone-list');
        this.closeBtn = document.getElementById('milestone-close');
        
        this.setupEvents();
        this.loadMilestones();
    }

    async loadMilestones() {
        try {
            // Add timestamp to prevent caching
            const url = `./assets/data/milestones.json?_=${Date.now()}`;
            const res = await fetch(url);
            this.milestones = await res.json();
            console.log('Milestones loaded:', this.milestones);
            
            // Generate codes
            this.milestones.forEach((m, i) => {
                // Deterministic "random" code based on index
                const seed = (i + 1) * 12345;
                const code = Math.floor(10000 + (seed % 90000));
                m.code = code;
            });

            this.checkMilestones(); // Initial check
        } catch (e) {
            console.error("Failed to load milestones", e);
        }
    }

    setupEvents() {
        if (this.btn) {
            // Ensure pointer events are enabled for the button
            this.btn.style.pointerEvents = 'auto';
            this.btn.onclick = (e) => {
                e.stopPropagation(); // Prevent bubbling issues
                this.openModal();
            };
            // Also add touchstart for better mobile response
            this.btn.ontouchstart = (e) => {
                e.stopPropagation();
                this.openModal();
            };
        }
        if (this.closeBtn) {
            this.closeBtn.onclick = () => this.closeModal();
        }
    }

    updateCoins(amount) {
        this.currentCoins = amount;
        this.checkMilestones();
    }

    checkMilestones() {
        if (!this.milestones.length) return;

        // Count unlocked
        const unlockedCount = this.milestones.filter(m => this.currentCoins >= m.points).length;
        
        // Update Notification
        if (unlockedCount > 0) {
            this.btn.className = 'state-1'; // Active Image
            this.notification.textContent = unlockedCount;
            this.notification.style.display = 'flex';
            
            // Shake if new milestone (count increased since last view)
            if (unlockedCount > this.lastSeenCount) {
                this.btn.classList.add('shake');
                this.notification.classList.remove('badge-grey'); // Red again
            }
        } else {
            this.btn.className = 'state-0'; // Default Image
            this.notification.style.display = 'none';
            this.btn.classList.remove('shake');
        }
        // Always visible now
        this.btn.style.display = 'block';
    }

    openModal() {
        this.game.paused = true;
        this.modal.style.display = 'flex';
        
        // Stop shake and grey out badge
        this.btn.classList.remove('shake');
        this.notification.classList.add('badge-grey');
        
        // Update last seen count to current unlocked count
        const unlockedCount = this.milestones.filter(m => this.currentCoins >= m.points).length;
        this.lastSeenCount = unlockedCount;

        this.renderList();
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.game.paused = false;
    }

    renderList() {
        this.list.innerHTML = '';
        
        this.milestones.forEach(m => {
            const isUnlocked = this.currentCoins >= m.points;
            
            const item = document.createElement('div');
            item.className = 'milestone-item';
            item.style.cssText = `
                background: rgba(255, 255, 255, ${isUnlocked ? '0.1' : '0.05'});
                border: 1px solid ${isUnlocked ? '#ffd700' : '#444'};
                padding: 15px;
                margin-bottom: 10px;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                opacity: ${isUnlocked ? '1' : '0.4'};
                transition: all 0.3s ease;
            `;
            
            const info = document.createElement('div');
            info.innerHTML = `
                <div style="color: ${isUnlocked ? '#ffd700' : '#fff'}; font-weight: bold; font-size: 18px; margin-bottom: 4px;">${m.title}</div>
                <div style="color: #ccc; font-size: 14px;">${m.subtitle}</div>
            `;
            
            if (isUnlocked) {
                const codeContainer = document.createElement('div');
                codeContainer.style.marginTop = '5px';
                codeContainer.style.fontSize = '12px';
                codeContainer.style.color = '#888';
                codeContainer.innerHTML = `copy code: <span style="color:#fff; cursor:pointer; text-decoration:underline;">${m.code}</span> <span class="copy-feedback" style="opacity:0; transition:opacity 0.5s; color:#00ff00; margin-left:5px;">Copied</span>`;
                
                const codeSpan = codeContainer.querySelector('span');
                const feedback = codeContainer.querySelector('.copy-feedback');
                
                codeSpan.onclick = () => {
                    navigator.clipboard.writeText(m.code);
                    feedback.style.opacity = '1';
                    setTimeout(() => { feedback.style.opacity = '0'; }, 2000);
                };
                
                info.appendChild(codeContainer);
            }

            const status = document.createElement('div');
            if (isUnlocked) {
                status.innerHTML = '✅';
                status.style.fontSize = '24px';
            } else {
                status.innerHTML = `<span style="font-size:12px; color:#888;">${this.currentCoins}/${m.points}</span>`;
            }
            
            item.appendChild(info);
            item.appendChild(status);
            this.list.appendChild(item);
        });
    }
}