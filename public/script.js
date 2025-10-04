// MQTT Configuration
const brokerHost = '141.11.160.14';
const websocketPort = 8083;
const brokerUrl = `ws://${brokerHost}:${websocketPort}/mqtt`;

// MQTT Topics
const temperatureTopic = 'rumahIman/smarthome/suhu';
const humidityTopic = 'rumahIman/smarthome/kelembaban';
const waterLevelTopic = 'rumahIman/smarthome/waterLevel';
const garageLightTopic = 'rumahIman/smarthome/garasi';
const garageLedTopic = 'rumahIman/smarthome/garasi/led';
const frontLightTopic = 'rumahIman/smarthome';
const frontLedTopic = 'rumahIman/smarthome/indikasi';
const terraceLightTopic = 'rumahIman/smarthome/lamputeras';
const terraceLedTopic = 'rumahIman/smarthome/lamputeras/led';

let mqttClient = null;
let isConnected = false;
let reconnectInterval = null;
let isUsingSimulatedData = false;

// Login Functionality
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // Password encryption check
    const encryptedPassword = btoa(password);
    const expectedPassword = btoa('admin2017');
    
    if (username === 'admin' && encryptedPassword === expectedPassword) {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'flex';
        initMQTT();
    } else {
        errorMessage.style.display = 'block';
    }
});

// Initialize MQTT connection
function initMQTT() {
    if (isConnected) {
        console.log('Already connected to MQTT broker');
        return;
    }
    
    updateConnectionStatus('Menghubungkan ke broker MQTT...', false);
    
    try {
        // Create MQTT client
        const clientId = 'webClient_' + Math.random().toString(16).substr(2, 8);
        
        mqttClient = mqtt.connect(brokerUrl, {
            clientId: clientId,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 0 // We'll handle reconnection manually
        });
        
        // Event handlers
        mqttClient.on('connect', function () {
            console.log('Connected to MQTT broker');
            isConnected = true;
            isUsingSimulatedData = false;
            updateConnectionStatus('Terhubung ke IoT Network', true);
            
            // Subscribe to topics
            mqttClient.subscribe(temperatureTopic, function (err) {
                if (!err) {
                    console.log('Subscribed to temperature topic');
                }
            });
            
            mqttClient.subscribe(humidityTopic, function (err) {
                if (!err) {
                    console.log('Subscribed to humidity topic');
                }
            });
            
            mqttClient.subscribe(waterLevelTopic, function (err) {
                if (!err) {
                    console.log('Subscribed to water level topic');
                }
            });
            
            mqttClient.subscribe(garageLedTopic, function (err) {
                if (!err) {
                    console.log('Subscribed to garage LED topic');
                }
            });
            
            mqttClient.subscribe(frontLedTopic, function (err) {
                if (!err) {
                    console.log('Subscribed to front LED topic');
                }
            });
            
            mqttClient.subscribe(terraceLedTopic, function (err) {
                if (!err) {
                    console.log('Subscribed to terrace LED topic');
                }
            });
            
            // Clear any existing reconnect interval
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
            }
        });
        
        mqttClient.on('message', function (topic, message) {
            // message is Buffer
            const value = message.toString();
            console.log(`Received message on ${topic}: ${value}`);
            
            let valueElement;
            switch(topic) {
                case temperatureTopic:
                    valueElement = document.getElementById("temperature-value");
                    valueElement.textContent = parseFloat(value).toFixed(1);
                    animateValue(valueElement);
                    break;
                case humidityTopic:
                    valueElement = document.getElementById("humidity-value");
                    valueElement.textContent = parseFloat(value).toFixed(1);
                    animateValue(valueElement);
                    break;
                case waterLevelTopic:
                    valueElement = document.getElementById("water-level-value");
                    valueElement.textContent = parseFloat(value).toFixed(1);
                    animateValue(valueElement);
                    break;
                case garageLedTopic:
                    updateLightStatus('garage', value);
                    break;
                case frontLedTopic:
                    updateLightStatus('front', value);
                    break;
                case terraceLedTopic:
                    updateLightStatus('terrace', value);
                    break;
            }
        });
        
        mqttClient.on('error', function (error) {
            console.error('MQTT connection error:', error);
            updateConnectionStatus('Error koneksi MQTT', false);
            
            if (!isUsingSimulatedData && !reconnectInterval) {
                // Try to reconnect every 5 seconds
                reconnectInterval = setInterval(initMQTT, 5000);
            }
        });
        
        mqttClient.on('close', function () {
            console.log('MQTT connection closed');
            isConnected = false;
            updateConnectionStatus('Koneksi terputus', false);
            
            if (!isUsingSimulatedData && !reconnectInterval) {
                // Try to reconnect every 5 seconds
                reconnectInterval = setInterval(initMQTT, 5000);
            }
        });
        
    } catch (error) {
        console.error('Error initializing MQTT:', error);
        updateConnectionStatus('Error inisialisasi MQTT', false);
        
        if (!isUsingSimulatedData && !reconnectInterval) {
            // Try to reconnect every 5 seconds
            reconnectInterval = setInterval(initMQTT, 5000);
        }
    }
}

// Disconnect MQTT
function disconnectMQTT() {
    if (mqttClient && isConnected) {
        mqttClient.end();
        mqttClient = null;
        isConnected = false;
    }
    
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    
    updateConnectionStatus('Terputus dari broker', false);
}

// Update connection status
function updateConnectionStatus(message, connected) {
    const indicator = document.getElementById('mqtt-status-indicator');
    const statusText = document.getElementById('mqtt-status-text');
    
    statusText.textContent = message;
    
    if (connected) {
        indicator.className = 'status-indicator online';
    } else if (message.includes('Menghubungkan')) {
        indicator.className = 'status-indicator connecting';
    } else {
        indicator.className = 'status-indicator offline';
    }
}

// Animate value when updated
function animateValue(element) {
    element.classList.add('value-updated');
    setTimeout(() => {
        element.classList.remove('value-updated');
    }, 1000);
}

// Update light status
function updateLightStatus(lightType, status) {
    const icon = document.getElementById(`${lightType}-light-icon`);
    
    if ((lightType === 'garage' && status === '1') || 
        (lightType === 'front' && status === '5') || 
        (lightType === 'terrace' && status === '1')) {
        icon.classList.remove('light-off');
        icon.classList.add('light-on');
    } else {
        icon.classList.remove('light-on');
        icon.classList.add('light-off');
    }
}

// Control button event listeners
document.getElementById('garage-on').addEventListener('click', function() {
    if (isConnected) {
        mqttClient.publish(garageLightTopic, '1');
        console.log('Sent garage ON command');
    } else {
        alert('MQTT tidak terhubung. Periksa koneksi Anda.');
    }
});

document.getElementById('garage-off').addEventListener('click', function() {
    if (isConnected) {
        mqttClient.publish(garageLightTopic, '0');
        console.log('Sent garage OFF command');
    } else {
        alert('MQTT tidak terhubung. Periksa koneksi Anda.');
    }
});

document.getElementById('front-on').addEventListener('click', function() {
    if (isConnected) {
        mqttClient.publish(frontLightTopic, '5');
        console.log('Sent front light ON command');
    } else {
        alert('MQTT tidak terhubung. Periksa koneksi Anda.');
    }
});

document.getElementById('front-off').addEventListener('click', function() {
    if (isConnected) {
        mqttClient.publish(frontLightTopic, '6');
        console.log('Sent front light OFF command');
    } else {
        alert('MQTT tidak terhubung. Periksa koneksi Anda.');
    }
});

document.getElementById('terrace-on').addEventListener('click', function() {
    if (isConnected) {
        mqttClient.publish(terraceLightTopic, '1');
        console.log('Sent terrace light ON command');
    } else {
        alert('MQTT tidak terhubung. Periksa koneksi Anda.');
    }
});

document.getElementById('terrace-off').addEventListener('click', function() {
    if (isConnected) {
        mqttClient.publish(terraceLightTopic, '0');
        console.log('Sent terrace light OFF command');
    } else {
        alert('MQTT tidak terhubung. Periksa koneksi Anda.');
    }
});