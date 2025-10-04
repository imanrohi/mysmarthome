const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/error', (req, res) => {
    res.sendFile(path.join(__dirname, 'error.html'));
});

// Health check endpoint untuk Heroku
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Smarthome app is running',
        timestamp: new Date().toISOString()
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'error.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Smarthome app running on port ${PORT}`);
    console.log(`📱 Access via: http://localhost:${PORT}`);
});