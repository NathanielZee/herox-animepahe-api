const express = require('express');
const Config = require('../utils/config');
const { errorHandler, CustomError } = require('../middleware/errorHandler');
const homeRoutes = require('../routes/homeRoutes');
const queueRoutes = require('../routes/queueRoutes');
const animeListRoutes = require('../routes/animeListRoutes');
const animeInfoRoutes = require('../routes/animeInfoRoutes');
const playRoutes = require('../routes/playRoutes');
const cache = require('../middleware/cache');
const redis = require('../utils/redis');

const app = express();

// Load environment variables into Config
try {
    Config.validate();
    Config.loadFromEnv();
    console.log('\x1b[36m%s\x1b[0m', 'Configuration loaded successfully');
} catch (error) {
    console.error('Configuration error:', error.message);
    // Don't exit in serverless - just continue with defaults
    console.log('Continuing with default configuration...');
}

// Health check endpoint (no cache) - Both routes work
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redis: {
            enabled: redis.enabled,
            healthy: redis.isHealthy()
        },
        memory: process.memoryUsage(),
        version: '1.0.0'
    };
    
    res.json(health);
});

app.get('/api/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redis: {
            enabled: redis.enabled,
            healthy: redis.isHealthy()
        },
        memory: process.memoryUsage(),
        version: '1.0.0'
    };
    
    res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AnimepaheAPI is running',
        endpoints: [
            'GET /health - Health check',
            'GET /api/health - Health check',
            'GET /api/airing - Get airing anime',
            'GET /api/search?q=query - Search anime',
            'GET /api/queue - Get encoding queue',
            'GET /api/anime - Get anime list',
            'GET /api/:id - Get anime info',
            'GET /api/:id/releases - Get anime episodes',
            'GET /api/play/:id?episodeId=xxx - Get streaming links'
        ],
        docs: 'https://github.com/NathanielZee/herox-animepahe-api',
        author: 'NathanielZee'
    });
});

// Middleware to set hostUrl for each request
app.use((req, res, next) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers.host;
        if (protocol && host) {
            Config.setHostUrl(protocol, host);
        }
        next();
    } catch (error) {
        console.error('Error setting host URL:', error.message);
        next(); // Continue even if this fails
    }
});

// API Routes with different cache durations - SAME AS APP.JS
app.use('/api', homeRoutes); // caching handled in homeRoutes
app.use('/api', cache(30), queueRoutes); // 30 seconds
app.use('/api', cache(3600), animeListRoutes); // 1 hour  
app.use('/api', cache(86400), animeInfoRoutes); // 1 day
app.use('/api', cache(1800), playRoutes); // 30 minutes

// 404 handler
app.use((req, res, next) => {
    next(new CustomError('Route not found. Check the API documentation at https://github.com/NathanielZee/herox-animepahe-api', 404));
});

// Global error handling middleware
app.use(errorHandler);

// Handle uncaught exceptions - SAME AS APP.JS
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // In serverless, we can't gracefully shutdown, just log
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In serverless, we can't gracefully shutdown, just log
});

// Export for Vercel (instead of starting a server)
module.exports = app;