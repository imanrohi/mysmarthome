const express = require('express');
const path = require('path');
const mqtt = require('mqtt');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MQTT Configuration
const MQTT_BROKER = 'ws://141.11.160.14:8083/mqtt';
let mqttClient = null;

// Initialize MQTT Connection
function initMQTT() {
    console.log('🔌 Connecting to MQTT broker:', MQTT_BROKER);
    
    mqttClient = mqtt.connect(MQTT_BROKER, {
        clientId: 'server_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 4000
    });

    mqttClient.on('connect', () => {
        console.log('✅ MQTT Connected to broker');
        
        // Subscribe to all topics
        const topics = [
            'rumahIman/smarthome/suhu',
            'rumahIman/smarthome/kelembaban',
            'rumahIman/smarthome/waterLevel',
            'rumahIman/smarthome/garasi/led',
            'rumahIman/smarthome/indikasi',
            'rumahIman/smarthome/lamputeras/led'
        ];
        
        topics.forEach(topic => {
            mqttClient.subscribe(topic, (err) => {
                if (err) {
                    console.error('❌ Subscribe error:', topic, err);
                } else {
                    console.log('✅ Subscribed to:', topic);
                }
            });
        });
    });

    mqttClient.on('error', (err) => {
        console.error('❌ MQTT Error:', err);
    });

    mqttClient.on('close', () => {
        console.log('🔌 MQTT Connection closed');
    });
}

// Initialize MQTT on server start
initMQTT();

// Store connected clients
const clients = new Set();

// HTTP Routes for MQTT Proxy
app.get('/api/mqtt/status', (req, res) => {
    res.json({
        connected: mqttClient ? mqttClient.connected : false,
        broker: MQTT_BROKER,
        timestamp: new Date().toISOString()
    });
});

// Publish message to MQTT
app.post('/api/mqtt/publish', (req, res) => {
    const { topic, message } = req.body;
    
    if (!mqttClient || !mqttClient.connected) {
        return res.status(500).json({ error: 'MQTT not connected' });
    }
    
    if (!topic || !message) {
        return res.status(400).json({ error: 'Topic and message required' });
    }
    
    mqttClient.publish(topic, message, (err) => {
        if (err) {
            console.error('❌ Publish error:', err);
            return res.status(500).json({ error: 'Publish failed' });
        }
        
        console.log('✅ Published:', topic, message);
        res.json({ success: true, topic, message });
    });
});

// Get current sensor values
app.get('/api/sensors', (req, res) => {
    // You can store last known values and return them
    res.json({
        temperature: '--',
        humidity: '--',
        waterLevel: '--',
        timestamp: new Date().toISOString()
    });
});

// WebSocket for real-time updates
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    clients.add(ws);
    
    // Send connection status
    ws.send(JSON.stringify({
        type: 'status',
        connected: mqttClient ? mqttClient.connected : false
    }));
    
    ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        clients.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('❌ WebSocket error:', err);
        clients.delete(ws);
    });
});

// Broadcast MQTT messages to all WebSocket clients
if (mqttClient) {
    mqttClient.on('message', (topic, message) => {
        const data = {
            type: 'mqtt_message',
            topic: topic,
            message: message.toString(),
            timestamp: new Date().toISOString()
        };
        
        console.log('📨 MQTT → WebSocket:', topic, message.toString());
        
        // Broadcast to all connected clients
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    });
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/error', (req, res) => {
    res.sendFile(path.join(__dirname, 'error.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        mqtt_connected: mqttClient ? mqttClient.connected : false,
        timestamp: new Date().toISOString()
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Smarthome app running on port ${PORT}`);
    console.log(`🔌 MQTT Proxy enabled`);
    console.log(`📱 Access via: http://localhost:${PORT}`);
});