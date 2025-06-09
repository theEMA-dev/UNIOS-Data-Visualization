class DataToggle {
    constructor() {
        this.currentModule = 'economics';
        this.modules = {
            economics: {
                name: 'Economics',
                icon: '📊'
            },
            environment: {
                name: 'Environment',
                icon: '🌱',
                disabled: true
            }
        };
        this.init();
    }

    init() {
        const toggle = document.createElement('div');
        toggle.className = 'data-toggle';
        toggle.innerHTML = `
            <div class="selected-module">
                <span class="module-icon">${this.modules[this.currentModule].icon}</span>
                <span class="module-name">${this.modules[this.currentModule].name}</span>
                <span class="dropdown-arrow">▼</span>
            </div>
            <div class="module-dropdown">
                ${Object.entries(this.modules).map(([key, module]) => `
                    <div class="module-option ${key === this.currentModule ? 'active' : ''} ${module.disabled ? 'disabled' : ''}" 
                         data-module="${key}">
                        <span class="module-icon">${module.icon}</span>
                        <span class="module-name">${module.name}</span>
                        ${module.disabled ? '<span class="coming-soon">Coming Soon</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;

        const headerTools = document.querySelector('.header-tools');
        headerTools.appendChild(toggle);

        this.attachEvents(toggle);
    }

    attachEvents(toggle) {
        const dropdown = toggle.querySelector('.module-dropdown');
        
        toggle.addEventListener('click', (e) => {
            if (e.target.closest('.selected-module')) {
                toggle.classList.toggle('active');
            }
        });

        dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.module-option');
            if (option && !option.classList.contains('disabled')) {
                const moduleKey = option.dataset.module;
                this.switchModule(moduleKey);
                toggle.classList.remove('active');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!toggle.contains(e.target)) {
                toggle.classList.remove('active');
            }
        });
    }

    switchModule(moduleKey) {
        if (this.currentModule === moduleKey) return;
        
        this.currentModule = moduleKey;
        const selectedModule = this.modules[moduleKey];
        
        const selected = document.querySelector('.selected-module');
        selected.querySelector('.module-icon').textContent = selectedModule.icon;
        selected.querySelector('.module-name').textContent = selectedModule.name;

        document.querySelectorAll('.module-option').forEach(option => {
            option.classList.toggle('active', option.dataset.module === moduleKey);
        });

        // Dispatch event for module change
        window.dispatchEvent(new CustomEvent('moduleChange', { 
            detail: { module: moduleKey } 
        }));
    }
}

// Export for module usage
window.DataToggle = DataToggle;
