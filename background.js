// Background script for Pomodoro Timer Extension

class PomodoroTimer {
    constructor() {
        this.state = {
            isRunning: false,
            isPaused: false,
            currentSession: 'focus', // 'focus', 'shortBreak', 'longBreak'
            timeRemaining: 25 * 60, // in seconds
            totalTime: 25 * 60,
            sessionsCompleted: 0,
            isBlocking: false
        };
        
        this.settings = {
            focusTime: 25,
            shortBreakTime: 5,
            longBreakTime: 15,
            blockedSites: []
        };

        this.init();
    }

    async init() {
        // Load saved state and settings
        await this.loadState();
        await this.loadSettings();
        
        // Set up alarm listener
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'pomodoroTimer') {
                this.tick();
            }
        });

        // Set up message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        // Initialize blocking rules
        await this.updateBlockingRules();
    }

    async loadState() {
        const result = await chrome.storage.local.get(['pomodoroState']);
        if (result.pomodoroState) {
            this.state = { ...this.state, ...result.pomodoroState };
        }
    }

    async saveState() {
        await chrome.storage.local.set({ pomodoroState: this.state });
    }

    async loadSettings() {
        const result = await chrome.storage.sync.get(['pomodoroSettings']);
        if (result.pomodoroSettings) {
            this.settings = { ...this.settings, ...result.pomodoroSettings };
        }
    }

    async saveSettings() {
        await chrome.storage.sync.set({ pomodoroSettings: this.settings });
        await this.updateBlockingRules();
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'GET_STATE':
                sendResponse({ 
                    state: this.state, 
                    settings: this.settings,
                    stats: await this.getStats()
                });
                break;
            
            case 'START_TIMER':
                await this.startTimer();
                sendResponse({ success: true });
                break;
            
            case 'PAUSE_TIMER':
                await this.pauseTimer();
                sendResponse({ success: true });
                break;
            
            case 'RESET_TIMER':
                await this.resetTimer();
                sendResponse({ success: true });
                break;
            
            case 'SKIP_SESSION':
                await this.skipSession();
                sendResponse({ success: true });
                break;
            
            case 'UPDATE_SETTINGS':
                this.settings = { ...this.settings, ...message.settings };
                await this.saveSettings();
                sendResponse({ success: true });
                break;
            
            case 'ADD_BLOCKED_SITE':
                await this.addBlockedSite(message.site);
                sendResponse({ success: true });
                break;
            
            case 'REMOVE_BLOCKED_SITE':
                await this.removeBlockedSite(message.site);
                sendResponse({ success: true });
                break;
        }
    }

    async startTimer() {
        if (this.state.isPaused) {
            this.state.isPaused = false;
        } else {
            this.resetCurrentSession();
        }
        
        this.state.isRunning = true;
        
        // Update blocking state
        this.state.isBlocking = this.state.currentSession === 'focus';
        
        // Start the alarm
        chrome.alarms.create('pomodoroTimer', { delayInMinutes: 0, periodInMinutes: 1/60 });
        
        await this.saveState();
        await this.updateIcon();
        await this.updateBlockingRules();
        this.notifyPopups();
    }

    async pauseTimer() {
        this.state.isRunning = false;
        this.state.isPaused = true;
        
        chrome.alarms.clear('pomodoroTimer');
        
        await this.saveState();
        await this.updateIcon();
        this.notifyPopups();
    }

    async resetTimer() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.isBlocking = false;
        
        this.resetCurrentSession();
        
        chrome.alarms.clear('pomodoroTimer');
        
        await this.saveState();
        await this.updateIcon();
        await this.updateBlockingRules();
        this.notifyPopups();
    }

    async skipSession() {
        await this.completeSession();
    }

    resetCurrentSession() {
        const sessionTimes = {
            focus: this.settings.focusTime * 60,
            shortBreak: this.settings.shortBreakTime * 60,
            longBreak: this.settings.longBreakTime * 60
        };
        
        this.state.timeRemaining = sessionTimes[this.state.currentSession];
        this.state.totalTime = sessionTimes[this.state.currentSession];
    }

    async tick() {
        if (!this.state.isRunning) return;
        
        this.state.timeRemaining--;
        
        if (this.state.timeRemaining <= 0) {
            await this.completeSession();
        }
        
        await this.saveState();
        this.notifyPopups();
    }

    async completeSession() {
        // Show notification
        this.showNotification();
        
        // Update session count and switch session type
        if (this.state.currentSession === 'focus') {
            this.state.sessionsCompleted++;
            await this.updateStats();
            
            // Determine next break type (long break every 4 sessions)
            if (this.state.sessionsCompleted % 4 === 0) {
                this.state.currentSession = 'longBreak';
            } else {
                this.state.currentSession = 'shortBreak';
            }
        } else {
            this.state.currentSession = 'focus';
        }
        
        // Reset timer for next session
        this.resetCurrentSession();
        
        // Stop timer and update blocking
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.isBlocking = false;
        
        chrome.alarms.clear('pomodoroTimer');
        
        await this.saveState();
        await this.updateIcon();
        await this.updateBlockingRules();
        this.notifyPopups();
    }

    showNotification() {
        const sessionNames = {
            focus: 'Focus Session',
            shortBreak: 'Short Break',
            longBreak: 'Long Break'
        };
        
        const nextSession = this.state.currentSession === 'focus' 
            ? (this.state.sessionsCompleted % 4 === 3 ? 'Long Break' : 'Short Break')
            : 'Focus Session';
            
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: `${sessionNames[this.state.currentSession]} Complete!`,
            message: `Time for a ${nextSession.toLowerCase()}!`
        });
    }

    async updateStats() {
        const today = new Date().toDateString();
        const stats = await chrome.storage.local.get(['pomodoroStats']) || {};
        const todayStats = stats.pomodoroStats?.[today] || { sessions: 0, focusTime: 0 };
        
        todayStats.sessions++;
        todayStats.focusTime += this.settings.focusTime;
        
        const newStats = {
            ...stats.pomodoroStats,
            [today]: todayStats
        };
        
        await chrome.storage.local.set({ pomodoroStats: newStats });
    }

    async getStats() {
        const today = new Date().toDateString();
        const stats = await chrome.storage.local.get(['pomodoroStats']);
        const todayStats = stats.pomodoroStats?.[today] || { sessions: 0, focusTime: 0 };
        
        return {
            sessionsToday: todayStats.sessions,
            totalFocusTime: todayStats.focusTime
        };
    }

    async addBlockedSite(site) {
        const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
        if (!this.settings.blockedSites.includes(cleanSite)) {
            this.settings.blockedSites.push(cleanSite);
            await this.saveSettings();
        }
    }

    async removeBlockedSite(site) {
        this.settings.blockedSites = this.settings.blockedSites.filter(s => s !== site);
        await this.saveSettings();
    }

    async updateBlockingRules() {
        // Clear existing rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIds = existingRules.map(rule => rule.id);
        
        if (ruleIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds
            });
        }
        
        // Add new blocking rules if timer is running and in focus mode
        if (this.state.isBlocking && this.settings.blockedSites.length > 0) {
            const rules = this.settings.blockedSites.map((site, index) => ({
                id: index + 1,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: {
                        url: chrome.runtime.getURL('blocked.html')
                    }
                },
                condition: {
                    urlFilter: `*://*.${site}/*`,
                    resourceTypes: ['main_frame']
                }
            }));
            
            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: rules
            });
        }
    }

    async updateIcon() {
        const iconPath = this.state.isRunning 
            ? (this.state.currentSession === 'focus' ? 'icons/icon_active.png' : 'icons/icon_break.png')
            : 'icons/icon48.png';
            
        chrome.action.setIcon({ path: iconPath });
        
        // Update badge with time remaining
        if (this.state.isRunning || this.state.isPaused) {
            const minutes = Math.floor(this.state.timeRemaining / 60);
            const seconds = this.state.timeRemaining % 60;
            chrome.action.setBadgeText({ 
                text: `${minutes}:${seconds.toString().padStart(2, '0')}` 
            });
            chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }

    notifyPopups() {
        chrome.runtime.sendMessage({
            type: 'STATE_UPDATE',
            state: this.state,
            settings: this.settings
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    }
}

// Initialize the timer when the extension starts
const timer = new PomodoroTimer();