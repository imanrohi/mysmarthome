// MQTT Configuration - FINAL FIXED VERSION
class MQTTManager {
    constructor() {
        this.brokerHost = '141.11.160.14';
        this.websocketPort = 8083;
        this.mqttClient = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.isUsingSimulatedData = false;
        this.currentBrokerIndex = 0;
        
        this.brokerUrls = this.generateBrokerUrls();
        this.setupEventListeners();
    }
    
    generateBrokerUrls() {
        const isHttps = window.location.protocol === 'https:';
        console.log('🔒 Environment:', isHttps ? 'HTTPS (Production)' : 'HTTP (Development)');
        
        if (isHttps) {
            // Production - hanya gunakan WSS
            return [
                `wss://${this.brokerHost}:${this.websocketPort}/mqtt`,
                `wss://${this.brokerHost}:${this.websocketPort}/ws`,
                `wss://${this.brokerHost}:${this.websocketPort}`
            ];
        } else {
            // Development - gunakan WS
            return [
                `ws://${this.brokerHost}:${this.websocketPort}/mqtt`,
                `ws://${this.brokerHost}:${this.websocketPort}/ws`,
                `ws://${this.brokerHost}:${this.websocketPort}`
            ];
        }
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
            this.initMQTT();
            this.startFallbackSystem();
        } else {
            errorMessage.style.display = 'block';
        }
    }
    
    initMQTT() {
        if (this.isConnected) {
            console.log('Already connected to MQTT broker');
            return;
        }
        
        if (this.currentBrokerIndex >= this.brokerUrls.length) {
            this.currentBrokerIndex = 0;
            console.log('🔄 All broker URLs tried, using fallback mode');
            this.enableFallbackMode();
            return;
        }
        
        const currentBrokerUrl = this.brokerUrls[this.currentBrokerIndex];
        this.updateConnectionStatus(`Menghubungkan ke broker...`, 'connecting');
        
        console.log(`🔌 Attempting MQTT connection: ${currentBrokerUrl}`);
        
        try {
            const clientId = 'webClient_' + Math.random().toString(16).substr(2, 8);
            
            const options = {
                clientId: clientId,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 0,
                keepalive: 60,
                protocolVersion: 4,
                rejectUnauthorized: false // Important for self-signed certificates
            };
            
            this.mqttClient = mqtt.connect(currentBrokerUrl, options);
            this.setupMQTTEvents(currentBrokerUrl);
            
        } catch (error) {
            console.error('💥 MQTT initialization error:', error);
            this.handleConnectionFailure();
        }
    }
    
    setupMQTTEvents(brokerUrl) {
        this.mqttClient.on('connect', () => {
            console.log('✅ Connected to MQTT broker:', brokerUrl);
            this.isConnected = true;
            this.isUsingSimulatedData = false;
            this.updateConnectionStatus('Terhubung ke IoT Network', 'connected');
            this.subscribeToTopics();
            
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        });
        
        this.mqttClient.on('message', (topic, message) => {
            const value = message.toString();
            console.log(`📨 MQTT Message: ${topic} = ${value}`);
            this.processMQTTMessage(topic, value);
        });
        
        this.mqttClient.on('error', (error) => {
            console.error('❌ MQTT Error:', error);
            this.handleConnectionFailure();
        });
        
        this.mqttClient.on('close', () => {
            console.log('🔌 MQTT connection closed');
            this.handleConnectionFailure();
        });
    }
    
    handleConnectionFailure() {
        this.isConnected = false;
        this.currentBrokerIndex++;
        
        if (this.currentBrokerIndex < this.brokerUrls.length) {
            this.updateConnectionStatus('Mencoba koneksi alternatif...', 'error');
            setTimeout(() => this.initMQTT(), 3000);
        } else {
            this.enableFallbackMode();
        }
    }
    
    enableFallbackMode() {
        console.log('🎮 Enabling fallback mode - No MQTT connection available');
        this.isUsingSimulatedData = true;
        this.updateConnectionStatus('Mode Simulasi (MQTT Tidak Tersedia)', 'error');
        this.generateSimulatedData();
    }
    
    subscribeToTopics() {
        const topics = [
            'rumahIman/smarthome/suhu',
            'rumahIman/smarthome/kelembaban', 
            'rumahIman/smarthome/waterLevel',
            'rumahIman/smarthome/garasi/led',
            'rumahIman/smarthome/indikasi',
            'rumahIman/smarthome/lamputeras/led'
        ];
        
        topics.forEach(topic => {
            this.mqttClient.subscribe(topic, { qos: 0 }, (err) => {
                if (err) {
                    console.error('❌ Subscribe error:', topic, err);
                } else {
                    console.log('✅ Subscribed to:', topic);
                }
            });
        });
    }
    
    processMQTTMessage(topic, value) {
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
                element.textContent = parseFloat(value).toFixed(1);
                this.animateValue(element);
            } else if (mapping.type === 'light') {
                this.updateLightStatus(mapping.id.replace('-light-icon', ''), value);
            }
        }
    }
    
    updateLightStatus(lightType, status) {
        const icon = document.getElementById(`${lightType}-light-icon`);
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
    
    publish(topic, message) {
        if (this.isConnected && this.mqttClient) {
            this.mqttClient.publish(topic, message, { qos: 0 }, (err) => {
                if (err) {
                    console.error('❌ Publish error:', err);
                    this.showToast('❌ Gagal mengirim perintah', 'error');
                } else {
                    console.log('✅ Published:', topic, message);
                    this.showToast('✅ Perintah terkirim', 'success');
                }
            });
        } else {
            console.log('🎮 Simulated publish:', topic, message);
            this.showToast('🎮 Mode Simulasi - Perintah tidak dikirim', 'warning');
            
            // Simulate light response
            if (topic.includes('garasi') && !topic.includes('led')) {
                setTimeout(() => this.updateLightStatus('garage', message), 500);
            } else if (topic === 'rumahIman/smarthome') {
                setTimeout(() => this.updateLightStatus('front', message), 500);
            } else if (topic.includes('lamputeras') && !topic.includes('led')) {
                setTimeout(() => this.updateLightStatus('terrace', message), 500);
            }
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
            document.getElementById(control.id).addEventListener('click', () => {
                this.publish(control.topic, control.payload);
            });
        });
    }
    
    startFallbackSystem() {
        setInterval(() => {
            if (!this.isConnected && !this.isUsingSimulatedData) {
                this.enableFallbackMode();
            }
        }, 15000);
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
        
        statusText.textContent = message;
        
        const statusClasses = {
            connected: 'online',
            connecting: 'connecting', 
            error: 'offline'
        };
        
        indicator.className = `status-indicator ${statusClasses[status] || 'offline'}`;
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
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize MQTT Manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.mqttManager = new MQTTManager();
});

// Add CSS animations
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