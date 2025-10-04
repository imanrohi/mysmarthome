// MQTT Proxy Manager
class MQTTProxyManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.isUsingSimulatedData = false;
        this.apiBase = window.location.origin;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Setup control buttons
        this.setupControlButtons();
    }
    
    handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('error-message');
        
        const encryptedPassword = btoa(password);
        const expectedPassword = btoa('admin2017');
        
        if (username === 'admin' && encryptedPassword === expectedPassword) {
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('main-page').style.display = 'flex';
            this.initWebSocket();
            this.startFallbackSystem();
        } else {
            errorMessage.style.display = 'block';
        }
    }
    
    initWebSocket() {
        if (this.ws) {
            this.ws.close();
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('🔌 Connecting to WebSocket:', wsUrl);
        this.updateConnectionStatus('Menghubungkan ke server...', 'connecting');
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.isUsingSimulatedData = false;
                this.updateConnectionStatus('Terhubung ke IoT Network', 'connected');
                
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ WebSocket message parse error:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.handleDisconnection();
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.handleDisconnection();
            };
            
        } catch (error) {
            console.error('💥 WebSocket initialization error:', error);
            this.handleDisconnection();
        }
    }
    
    handleWebSocketMessage(data) {
        console.log('📨 WebSocket message:', data);
        
        switch (data.type) {
            case 'status':
                this.updateConnectionStatus(
                    data.connected ? 'Terhubung ke IoT Network' : 'Menghubungkan...',
                    data.connected ? 'connected' : 'connecting'
                );
                break;
                
            case 'mqtt_message':
                this.processMQTTMessage(data.topic, data.message);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    processMQTTMessage(topic, message) {
        const mappings = {
            'rumahIman/smarthome/suhu': { id: 'temperature-value', type: 'sensor' },
            'rumahIman/smarthome/kelembaban': { id: 'humidity-value', type: 'sensor' },
            'rumahIman/smarthome/waterLevel': { id: 'water-level-value', type: 'sensor' },
            'rumahIman/smarthome/garasi/led': { id: 'garage-light-icon', type: 'light' },
            'rumahIman/smarthome/indikasi': { id: 'front-light-icon', type: 'light' },
            'rumahIman/smarthome/lamputeras/led': { id: 'terrace-light-icon', type: 'light' }
        };
        
        const mapping = mappings[topic];
        if (mapping) {
            if (mapping.type === 'sensor') {
                const element = document.getElementById(mapping.id);
                if (element) {
                    element.textContent = parseFloat(message).toFixed(1);
                    this.animateValue(element);
                }
            } else if (mapping.type === 'light') {
                this.updateLightStatus(mapping.id.replace('-light-icon', ''), message);
            }
        }
    }
    
    handleDisconnection() {
        this.isConnected = false;
        this.updateConnectionStatus('Koneksi terputus', 'error');
        
        // Try to reconnect
        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                console.log('🔄 Attempting WebSocket reconnection...');
                this.initWebSocket();
            }, 5000);
        }
    }
    
    async publish(topic, message) {
    console.log(`🚀 Attempting to publish: ${topic} = ${message}`);
    
    // Show immediate feedback
    this.showToast('🔄 Mengirim perintah...', 'info');
    
    try {
        // Method 1: Try HTTP API first (more reliable)
        const response = await fetch('/api/mqtt/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic, message })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ HTTP Publish success:', result);
            this.showToast('✅ Perintah terkirim via HTTP', 'success');
            
            // Simulate LED update
            this.simulateLightResponse(topic, message);
            return;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ HTTP Publish failed:', error);
        
        // Method 2: Try WebSocket as fallback
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const wsMessage = {
                    type: 'publish',
                    topic: topic,
                    message: message
                };
                this.ws.send(JSON.stringify(wsMessage));
                console.log('✅ WebSocket publish sent:', wsMessage);
                this.showToast('✅ Perintah terkirim via WebSocket', 'success');
                
                // Simulate LED update
                this.simulateLightResponse(topic, message);
                return;
                
            } catch (wsError) {
                console.error('❌ WebSocket publish failed:', wsError);
            }
        }
        
        // Method 3: Fallback to simulation
        console.log('🎮 Using simulation mode');
        this.showToast('🎮 Mode Simulasi - Perintah lokal', 'warning');
        this.simulateLightResponse(topic, message);
    }
}
    
    simulateLightResponse(topic, message) {
    console.log(`💡 Simulating light response: ${topic} = ${message}`);
    
    let lightType = '';
    let status = message;
    
    if (topic.includes('garasi') && !topic.includes('led')) {
        lightType = 'garage';
    } else if (topic === 'rumahIman/smarthome') {
        lightType = 'front';
        // Convert payload to LED format
        status = message === '5' ? '5' : '6';
    } else if (topic.includes('lamputeras') && !topic.includes('led')) {
        lightType = 'terrace';
    }
    
    if (lightType) {
        console.log(`💡 Updating ${lightType} light to: ${status}`);
        this.updateLightStatus(lightType, status);
    }
}
    
    updateLightStatus(lightType, status) {
        const icon = document.getElementById(`${lightType}-light-icon`);
        if (!icon) return;
        
        const isOn = (lightType === 'garage' && status === '1') || 
                     (lightType === 'front' && status === '5') || 
                     (lightType === 'terrace' && status === '1');
        
        if (isOn) {
            icon.classList.remove('light-off');
            icon.classList.add('light-on');
        } else {
            icon.classList.remove('light-on');
            icon.classList.add('light-off');
        }
    }
    
    setupControlButtons() {
        const controls = [
            { id: 'garage-on', topic: 'rumahIman/smarthome/garasi', payload: '1' },
            { id: 'garage-off', topic: 'rumahIman/smarthome/garasi', payload: '0' },
            { id: 'front-on', topic: 'rumahIman/smarthome', payload: '5' },
            { id: 'front-off', topic: 'rumahIman/smarthome', payload: '6' },
            { id: 'terrace-on', topic: 'rumahIman/smarthome/lamputeras', payload: '1' },
            { id: 'terrace-off', topic: 'rumahIman/smarthome/lamputeras', payload: '0' }
        ];
        
        controls.forEach(control => {
            const button = document.getElementById(control.id);
            if (button) {
                button.addEventListener('click', () => {
                    this.publish(control.topic, control.payload);
                });
            }
        });
    }
    
    startFallbackSystem() {
        // Generate initial simulated data
        setTimeout(() => {
            if (!this.isConnected) {
                this.generateSimulatedData();
            }
        }, 2000);
        
        // Periodic check
        setInterval(() => {
            if (!this.isConnected && !this.isUsingSimulatedData) {
                this.isUsingSimulatedData = true;
                this.updateConnectionStatus('Mode Simulasi (Server Offline)', 'error');
                this.generateSimulatedData();
            }
        }, 10000);
    }
    
    generateSimulatedData() {
        const elements = {
            'temperature-value': () => (Math.random() * 10 + 25).toFixed(1),
            'humidity-value': () => (Math.random() * 30 + 60).toFixed(1),
            'water-level-value': () => (Math.random() * 50 + 30).toFixed(1)
        };
        
        Object.entries(elements).forEach(([id, generator]) => {
            const element = document.getElementById(id);
            if (element && element.textContent === '--') {
                element.textContent = generator();
            }
        });
    }
    
    updateConnectionStatus(message, status) {
        const indicator = document.getElementById('mqtt-status-indicator');
        const statusText = document.getElementById('mqtt-status-text');
        
        if (statusText) {
            statusText.textContent = message;
        }
        
        if (indicator) {
            const statusClasses = {
                connected: 'online',
                connecting: 'connecting', 
                error: 'offline'
            };
            indicator.className = `status-indicator ${statusClasses[status] || 'offline'}`;
        }
    }
    
    animateValue(element) {
        element.classList.add('value-updated');
        setTimeout(() => {
            element.classList.remove('value-updated');
        }, 1000);
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        const colors = {
            success: '#4CAF50',
            error: '#F44336', 
            warning: '#FF9800',
            info: '#2196F3'
        };
        
        toast.style.backgroundColor = colors[type] || colors.info;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.mqttManager = new MQTTProxyManager();
});

// Add CSS animations for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);