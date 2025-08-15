// Popup script for Pomodoro Timer Extension

class PomodoroPopup {
    constructor() {
        this.state = null;
        this.settings = null;
        this.init();
    }

    async init() {
        // Get initial state
        await this.updateState();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up message listener for state updates
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'STATE_UPDATE') {
                this.state = message.state;
                this.settings = message.settings;
                this.updateUI();
            }
        });

        // Update UI initially
        this.updateUI();
        this.updateStats();
    }

    async updateState() {
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        this.state = response.state;
        this.settings = response.settings;
        this.stats = response.stats;
    }

    setupEventListeners() {
        // Timer controls
        document.getElementById('startBtn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'START_TIMER' });
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
        });

        document.getElementById('skipBtn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'SKIP_SESSION' });
        });

        // Settings
        document.getElementById('focusTime').addEventListener('change', (e) => {
            this.updateSetting('focusTime', parseInt(e.target.value));
        });

        document.getElementById('breakTime').addEventListener('change', (e) => {
            this.updateSetting('shortBreakTime', parseInt(e.target.value));
        });

        document.getElementById('longBreakTime').addEventListener('change', (e) => {
            this.updateSetting('longBreakTime', parseInt(e.target.value));
        });

        // Blocked sites
        document.getElementById('addSiteBtn').addEventListener('click', () => {
            this.addBlockedSite();
        });

        document.getElementById('siteInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addBlockedSite();
            }
        });
    }

    updateUI() {
        if (!this.state) return;

        // Update timer display
        const minutes = Math.floor(this.state.timeRemaining / 60);
        const seconds = this.state.timeRemaining % 60;
        document.getElementById('timerDisplay').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update session type
        const sessionTypes = {
            focus: 'Focus Session',
            shortBreak: 'Short Break',
            longBreak: 'Long Break'
        };
        document.getElementById('sessionType').textContent = sessionTypes[this.state.currentSession];

        // Update progress bar
        const progress = ((this.state.totalTime - this.state.timeRemaining) / this.state.totalTime) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;

        // Update button states
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const skipBtn = document.getElementById('skipBtn');

        if (this.state.isRunning) {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            skipBtn.disabled = false;
            startBtn.textContent = 'Running...';
        } else if (this.state.isPaused) {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            skipBtn.disabled = false;
            startBtn.textContent = 'Resume';
        } else {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            skipBtn.disabled = true;
            startBtn.textContent = 'Start';
        }

        // Show/hide blocking message
        const blockedMessage = document.getElementById('blockedMessage');
        if (this.state.isBlocking) {
            blockedMessage.style.display = 'block';
        } else {
            blockedMessage.style.display = 'none';
        }

        // Update settings values
        if (this.settings) {
            document.getElementById('focusTime').value = this.settings.focusTime;
            document.getElementById('breakTime').value = this.settings.shortBreakTime;
            document.getElementById('longBreakTime').value = this.settings.longBreakTime;
            
            this.updateBlockedSitesList();
        }
    }

    async updateStats() {
        if (!this.stats) return;
        
        document.getElementById('sessionsToday').textContent = this.stats.sessionsToday;
        
        const hours = Math.floor(this.stats.totalFocusTime / 60);
        const minutes = this.stats.totalFocusTime % 60;
        document.getElementById('totalTime').textContent = `${hours}h ${minutes}m`;
    }

    async updateSetting(key, value) {
        const settings = {};
        settings[key] = value;
        await chrome.runtime.sendMessage({ 
            type: 'UPDATE_SETTINGS', 
            settings: settings 
        });
        await this.updateState();
        this.updateUI();
    }

    async addBlockedSite() {
        const siteInput = document.getElementById('siteInput');
        const site = siteInput.value.trim();
        
        if (site) {
            await chrome.runtime.sendMessage({ 
                type: 'ADD_BLOCKED_SITE', 
                site: site 
            });
            siteInput.value = '';
            await this.updateState();
            this.updateBlockedSitesList();
        }
    }

    async removeBlockedSite(site) {
        await chrome.runtime.sendMessage({ 
            type: 'REMOVE_BLOCKED_SITE', 
            site: site 
        });
        await this.updateState();
        this.updateBlockedSitesList();
    }

    updateBlockedSitesList() {
        const siteList = document.getElementById('siteList');
        siteList.innerHTML = '';

        if (!this.settings || !this.settings.blockedSites) return;

        this.settings.blockedSites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            
            const siteText = document.createElement('span');
            siteText.textContent = site;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-site';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                this.removeBlockedSite(site);
            });
            
            siteItem.appendChild(siteText);
            siteItem.appendChild(removeBtn);
            siteList.appendChild(siteItem);
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroPopup();
});