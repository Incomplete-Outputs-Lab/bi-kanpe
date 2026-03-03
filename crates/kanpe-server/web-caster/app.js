// Bi-Kanpe Web Caster Application

// State
const state = {
    ws: null,
    connected: false,
    clientName: '',
    selectedMonitorIds: [],
    availableMonitors: [],
    currentMessage: null,
    timers: null, // { timestamp_ms, timers: [{ definition, runtime }] }
    fontSize: 4, // rem
    theme: 'light',
};

// Default feedback templates (can be customized)
const DEFAULT_TEMPLATES = [
    { id: '1', content: '了解しました', feedback_type: 'ack' },
    { id: '2', content: '準備完了', feedback_type: 'ack' },
    { id: '3', content: '質問があります', feedback_type: 'question' },
    { id: '4', content: '確認お願いします', feedback_type: 'question' },
    { id: '5', content: '問題が発生しました', feedback_type: 'issue' },
    { id: '6', content: '遅れています', feedback_type: 'info' },
];

// DOM Elements
const elements = {
    connectionScreen: document.getElementById('connection-screen'),
    displayScreen: document.getElementById('display-screen'),
    clientNameInput: document.getElementById('client-name'),
    monitorList: document.getElementById('monitor-list'),
    connectBtn: document.getElementById('connect-btn'),
    connectionError: document.getElementById('connection-error'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    messageDisplay: document.getElementById('message-display'),
    waitingState: document.getElementById('waiting-state'),
    messageContent: document.getElementById('message-content'),
    messageText: document.getElementById('message-text'),
    priorityBadge: document.getElementById('priority-badge'),
    monitorName: document.getElementById('monitor-name'),
    feedbackToggle: document.getElementById('feedback-toggle'),
    feedbackPanel: document.getElementById('feedback-panel'),
    feedbackTabs: document.querySelectorAll('.feedback-tab'),
    replyTab: document.getElementById('reply-tab'),
    newTab: document.getElementById('new-tab'),
    replyDisabled: document.getElementById('reply-disabled'),
    replyButtons: document.getElementById('reply-buttons'),
    newButtons: document.getElementById('new-buttons'),
    feedbackStatus: document.getElementById('feedback-status'),
    fontIncrease: document.getElementById('font-increase'),
    fontDecrease: document.getElementById('font-decrease'),
    fontSizeDisplay: document.getElementById('font-size-display'),
    themeToggle: document.getElementById('theme-toggle'),
    timerBar: document.getElementById('timer-bar'),
    timerBarList: document.getElementById('timer-bar-list'),
};

// Utility: Generate UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Utility: Get current timestamp
function getTimestamp() {
    return Date.now();
}

// Initialize
function init() {
    loadSettings();
    setupEventListeners();
    detectAvailableMonitors();
}

// Load saved settings
function loadSettings() {
    const savedClientName = localStorage.getItem('clientName');
    if (savedClientName) {
        elements.clientNameInput.value = savedClientName;
    }
    
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
        state.fontSize = parseFloat(savedFontSize);
        updateFontSize();
    }
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        state.theme = savedTheme;
        applyTheme();
    }
}

// Setup event listeners
function setupEventListeners() {
    elements.connectBtn.addEventListener('click', handleConnect);
    elements.disconnectBtn.addEventListener('click', handleDisconnect);
    elements.feedbackToggle.addEventListener('click', toggleFeedbackPanel);
    elements.fontIncrease.addEventListener('click', () => adjustFontSize(0.5));
    elements.fontDecrease.addEventListener('click', () => adjustFontSize(-0.5));
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    elements.feedbackTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// Detect available monitors (request from server after connection)
function detectAvailableMonitors() {
    // Will be populated after connection via MonitorListSync message
    state.availableMonitors = [];
}

// Render monitor selection grid
function renderMonitorSelection() {
    elements.monitorList.innerHTML = '';
    
    state.availableMonitors.forEach(monitor => {
        const option = document.createElement('div');
        option.className = 'monitor-option';
        option.dataset.monitorId = monitor.id;
        
        option.innerHTML = `
            <div class="monitor-id">${monitor.id}</div>
            <div class="monitor-name">${monitor.name}</div>
        `;
        
        option.addEventListener('click', () => toggleMonitorSelection(monitor.id, option));
        elements.monitorList.appendChild(option);
    });
}

// Toggle monitor selection
function toggleMonitorSelection(monitorId, element) {
    const index = state.selectedMonitorIds.indexOf(monitorId);
    if (index > -1) {
        state.selectedMonitorIds.splice(index, 1);
        element.classList.remove('selected');
    } else {
        state.selectedMonitorIds.push(monitorId);
        element.classList.add('selected');
    }
}

// Connect to server
function handleConnect() {
    const clientName = elements.clientNameInput.value.trim();
    
    if (!clientName) {
        showError('クライアント名を入力してください');
        return;
    }
    
    if (state.selectedMonitorIds.length === 0) {
        showError('表示するモニターを選択してください');
        return;
    }
    
    state.clientName = clientName;
    localStorage.setItem('clientName', clientName);
    
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
        state.ws = new WebSocket(wsUrl);
        
        state.ws.onopen = handleWebSocketOpen;
        state.ws.onmessage = handleWebSocketMessage;
        state.ws.onerror = handleWebSocketError;
        state.ws.onclose = handleWebSocketClose;
        
        elements.connectBtn.disabled = true;
        elements.connectBtn.textContent = '接続中...';
    } catch (error) {
        showError('接続に失敗しました: ' + error.message);
    }
}

// WebSocket opened
function handleWebSocketOpen() {
    console.log('WebSocket connected');
    
    // Send ClientHello
    const hello = {
        type: 'client_hello',
        id: generateUUID(),
        timestamp: getTimestamp(),
        payload: {
            client_name: state.clientName,
            display_monitor_ids: state.selectedMonitorIds,
        },
    };
    
    state.ws.send(JSON.stringify(hello));
}

// WebSocket message received
function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'server_welcome':
                handleServerWelcome(message);
                break;
            case 'monitor_list_sync':
                handleMonitorListSync(message);
                break;
            case 'kanpe_message':
                handleKanpeMessage(message);
                break;
            case 'flash_command':
                handleFlashCommand(message);
                break;
            case 'clear_command':
                handleClearCommand(message);
                break;
            case 'monitor_added':
            case 'monitor_removed':
            case 'monitor_updated':
                // Handle monitor updates if needed
                break;
            case 'timer_state_update':
                handleTimerStateUpdate(message);
                break;
            case 'ping':
                // Respond with pong
                sendPong();
                break;
        }
    } catch (error) {
        console.error('Failed to parse message:', error);
    }
}

// Handle ServerWelcome
function handleServerWelcome(message) {
    console.log('Connected to server:', message.payload.server_name);
    state.connected = true;
    
    // Switch to display screen
    elements.connectionScreen.style.display = 'none';
    elements.displayScreen.style.display = 'flex';
    
    // Update monitor name display
    const monitorNames = state.selectedMonitorIds.map(id => {
        const monitor = state.availableMonitors.find(m => m.id === id);
        return monitor ? monitor.name : id;
    }).join(', ');
    elements.monitorName.textContent = `● ${monitorNames}`;
}

// Handle MonitorListSync
function handleMonitorListSync(message) {
    state.availableMonitors = message.payload.monitors;
    
    if (!state.connected) {
        // Still on connection screen, render monitor selection
        renderMonitorSelection();
    }
}

// Handle KanpeMessage
function handleKanpeMessage(message) {
    const payload = message.payload;
    const targetIds = payload.target_monitor_ids;
    
    // Filter message based on target_monitor_ids
    const shouldDisplay = targetIds.includes('ALL') || 
                         state.selectedMonitorIds.some(id => targetIds.includes(id));
    
    if (!shouldDisplay) {
        return;
    }
    
    // Store current message
    state.currentMessage = message;
    
    // Update display
    elements.waitingState.style.display = 'none';
    elements.messageContent.style.display = 'block';
    
    elements.messageText.textContent = payload.content;
    elements.messageText.className = `message-text ${payload.priority}`;
    
    // Update priority badge
    const priorityText = {
        urgent: '🚨 緊急',
        high: '⚠ 重要',
        normal: '📝 通常',
    }[payload.priority] || '📝 通常';
    
    elements.priorityBadge.textContent = priorityText;
    elements.priorityBadge.className = `priority-badge ${payload.priority}`;
    
    // Update background
    elements.messageDisplay.className = `message-display ${payload.priority}`;
    
    // Flash on urgent
    if (payload.priority === 'urgent') {
        elements.messageDisplay.classList.add('flash-animation');
        setTimeout(() => {
            elements.messageDisplay.classList.remove('flash-animation');
        }, 1500);
    }
    
    // Update feedback buttons
    updateFeedbackButtons();
}

// Handle FlashCommand
function handleFlashCommand(message) {
    const targetIds = message.payload.target_monitor_ids;
    const shouldFlash = targetIds.includes('ALL') || 
                       state.selectedMonitorIds.some(id => targetIds.includes(id));
    
    if (shouldFlash) {
        elements.messageDisplay.classList.add('flash-animation');
        setTimeout(() => {
            elements.messageDisplay.classList.remove('flash-animation');
        }, 1500);
    }
}

// Handle TimerStateUpdate
function handleTimerStateUpdate(message) {
    state.timers = message.payload || null;
    renderTimerBar();
}

// Filter timers by selected monitor IDs (ALL or intersection)
function getVisibleTimers() {
    if (!state.timers || !state.timers.timers || state.timers.timers.length === 0) return [];
    const selected = state.selectedMonitorIds;
    return state.timers.timers.filter(function(entry) {
        const targets = entry.definition.target_monitor_ids || [];
        if (targets.includes('ALL')) return true;
        if (selected.length === 0) return true;
        return targets.some(function(id) { return selected.indexOf(id) !== -1; });
    });
}

// Format remaining ms as MM:SS or HH:MM:SS
function formatRemainingMs(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    if (hours > 0) return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    return pad(minutes) + ':' + pad(seconds);
}

// State label for timer
function getTimerStateLabel(s) {
    switch (s) {
        case 'running': return '▶ 進行中';
        case 'paused': return '⏸ 一時停止';
        case 'completed': return '✓ 完了';
        case 'cancelled': return '✕ 中止';
        case 'pending':
        default: return '待機中';
    }
}

// Render timer bar (only when connected and visible timers exist)
function renderTimerBar() {
    if (!elements.timerBar || !elements.timerBarList || !elements.displayScreen) return;
    const visible = getVisibleTimers();
    if (!state.connected || visible.length === 0) {
        elements.timerBar.style.display = 'none';
        elements.displayScreen.classList.remove('has-timer-bar');
        return;
    }
    elements.timerBar.style.display = 'block';
    elements.displayScreen.classList.add('has-timer-bar');
    elements.timerBarList.innerHTML = '';
    visible.forEach(function(entry) {
        const def = entry.definition;
        const runtime = entry.runtime;
        const badge = document.createElement('div');
        badge.className = 'timer-badge timer-state-' + (runtime.state || 'pending');
        badge.innerHTML = '<span class="timer-badge-name">' + (def.name || '') + '</span>' +
            '<span class="timer-badge-time">' + formatRemainingMs(runtime.remaining_ms || 0) + '</span>' +
            '<span class="timer-badge-state">' + getTimerStateLabel(runtime.state) + '</span>';
        elements.timerBarList.appendChild(badge);
    });
}

// Handle ClearCommand
function handleClearCommand(message) {
    const targetIds = message.payload.target_monitor_ids;
    const shouldClear = targetIds.includes('ALL') || 
                       state.selectedMonitorIds.some(id => targetIds.includes(id));
    
    if (shouldClear) {
        state.currentMessage = null;
        elements.messageContent.style.display = 'none';
        elements.waitingState.style.display = 'block';
        elements.messageDisplay.className = 'message-display';
    }
}

// Send Pong
function sendPong() {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    
    const pong = {
        type: 'pong',
        id: generateUUID(),
        timestamp: getTimestamp(),
    };
    
    state.ws.send(JSON.stringify(pong));
}

// WebSocket error
function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    showError('接続エラーが発生しました');
    elements.connectBtn.disabled = false;
    elements.connectBtn.textContent = '接続';
}

// WebSocket closed
function handleWebSocketClose() {
    console.log('WebSocket closed');
    state.connected = false;
    state.ws = null;
    
    if (elements.displayScreen.style.display !== 'none') {
        // Was connected, show disconnection
        alert('サーバーから切断されました');
        handleDisconnect();
    }
}

// Disconnect
function handleDisconnect() {
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }
    
    state.connected = false;
    state.currentMessage = null;
    state.timers = null;
    renderTimerBar();
    
    elements.displayScreen.style.display = 'none';
    elements.connectionScreen.style.display = 'flex';
    elements.connectBtn.disabled = false;
    elements.connectBtn.textContent = '接続';
    
    // Reset feedback panel
    elements.feedbackPanel.classList.remove('active');
    elements.feedbackToggle.classList.remove('active');
}

// Show error message
function showError(message) {
    elements.connectionError.textContent = message;
    elements.connectionError.style.display = 'block';
    
    setTimeout(() => {
        elements.connectionError.style.display = 'none';
    }, 5000);
}

// Toggle feedback panel
function toggleFeedbackPanel() {
    elements.feedbackPanel.classList.toggle('active');
    elements.feedbackToggle.classList.toggle('active');
    
    if (elements.feedbackPanel.classList.contains('active')) {
        elements.feedbackToggle.textContent = '✕ 閉じる';
        updateFeedbackButtons();
    } else {
        elements.feedbackToggle.textContent = '💬 フィードバック';
    }
}

// Switch feedback tab
function switchTab(tabName) {
    elements.feedbackTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'reply') {
        elements.replyTab.classList.add('active');
    } else if (tabName === 'new') {
        elements.newTab.classList.add('active');
    }
}

// Update feedback buttons
function updateFeedbackButtons() {
    // Reply buttons
    if (state.currentMessage) {
        elements.replyDisabled.style.display = 'none';
        elements.replyButtons.innerHTML = '';
        
        DEFAULT_TEMPLATES.forEach(template => {
            const btn = createFeedbackButton(template, true);
            elements.replyButtons.appendChild(btn);
        });
    } else {
        elements.replyDisabled.style.display = 'block';
        elements.replyButtons.innerHTML = '';
    }
    
    // New message buttons
    elements.newButtons.innerHTML = '';
    DEFAULT_TEMPLATES.forEach(template => {
        const btn = createFeedbackButton(template, false);
        elements.newButtons.appendChild(btn);
    });
}

// Create feedback button
function createFeedbackButton(template, isReply) {
    const btn = document.createElement('button');
    btn.className = `feedback-btn ${template.feedback_type}`;
    
    const typeLabel = {
        ack: '✓ 了解',
        question: '? 質問',
        issue: '⚠ 問題',
        info: 'ℹ 情報',
    }[template.feedback_type];
    
    btn.innerHTML = `
        <span class="feedback-btn-type">${typeLabel}</span>
        <span class="feedback-btn-content">${template.content}</span>
    `;
    
    btn.addEventListener('click', () => sendFeedback(template, isReply));
    
    return btn;
}

// Send feedback
function sendFeedback(template, isReply) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    
    const feedback = {
        type: 'feedback_message',
        id: generateUUID(),
        timestamp: getTimestamp(),
        payload: {
            content: template.content,
            client_name: state.clientName,
            reply_to_message_id: isReply && state.currentMessage ? state.currentMessage.id : '',
            feedback_type: template.feedback_type,
        },
    };
    
    state.ws.send(JSON.stringify(feedback));
    
    // Show status
    elements.feedbackStatus.style.display = 'block';
    setTimeout(() => {
        elements.feedbackStatus.style.display = 'none';
    }, 1500);
}

// Adjust font size
function adjustFontSize(delta) {
    state.fontSize = Math.max(1, Math.min(8, state.fontSize + delta));
    localStorage.setItem('fontSize', state.fontSize.toString());
    updateFontSize();
}

// Update font size
function updateFontSize() {
    elements.messageText.style.fontSize = `${state.fontSize}rem`;
    elements.fontSizeDisplay.textContent = `${state.fontSize}rem`;
}

// Toggle theme
function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

// Apply theme
function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    elements.themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
}

// Request monitor list from server (fallback if not auto-sent)
function requestMonitorList() {
    // For initial connection, monitors will be sent via MonitorListSync
    // This is a placeholder if we need manual request later
    state.availableMonitors = [
        { id: 'A', name: 'モニターA', description: '', color: '' },
        { id: 'B', name: 'モニターB', description: '', color: '' },
        { id: 'C', name: 'モニターC', description: '', color: '' },
        { id: 'D', name: 'モニターD', description: '', color: '' },
    ];
    renderMonitorSelection();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// For development: show monitor selection immediately
// In production, this will be populated after connection
requestMonitorList();
