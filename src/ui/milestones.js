export class MilestoneSystem {
    constructor(game) {
        this.game = game;
        this.milestones = [];
        this.currentCoins = 0;
        
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
            this.btn.onclick = () => this.openModal();
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
            this.btn.style.display = 'flex';
            this.notification.textContent = unlockedCount;
            this.notification.style.display = 'flex';
        } else {
            // Keep button visible but maybe no notification? 
            // User said "show a 'gift box' icon button... with a small notification number"
            // "Whenever the player reachs a certain amount of points, you can show a 'gift box' icon button"
            // Implies it might be hidden otherwise? Or maybe always visible?
            // Let's keep it visible if at least one is unlocked, or maybe always visible to show progress?
            // "Whenever the player reachs... you can show" -> implies hidden before?
            // Let's hide if 0 unlocked for now, or show always?
            // "show a 'gift box' icon button... with a small notification number showing the prizes available"
            // I'll show it always but only show notification for unlocked ones.
            this.btn.style.display = 'flex';
            this.notification.style.display = unlockedCount > 0 ? 'flex' : 'none';
        }
    }

    openModal() {
        this.game.paused = true;
        this.modal.style.display = 'flex';
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