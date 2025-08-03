const express = require('express');
const Config = require('./utils/config');
const { errorHandler, CustomError } = require('./middleware/errorHandler');
const homeRoutes = require('./routes/homeRoutes');
const queueRoutes = require('./routes/queueRoutes');
const animeListRoutes = require('./routes/animeListRoutes');
const animeInfoRoutes = require('./routes/animeInfoRoutes');
const playRoutes = require('./routes/playRoutes');
const cache = require('./middleware/cache');
const redis = require('./utils/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Load environment variables into Config
try {
    Config.validate();
    Config.loadFromEnv();
    console.log('\x1b[36m%s\x1b[0m', 'Configuration loaded successfully');
} catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
}

// Health check endpoint (no cache)
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

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AnimepaheAPI is running',
        endpoints: [
            'GET /health - Health check',
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

// API Routes with different cache durations
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

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new requests
    server.close(async () => {
        console.log('HTTP server closed');
        
        try {
            // Cleanup Redis connection
            if (redis.enabled) {
                await redis.disconnect();
            }
            
            console.log('Cleanup completed');
            process.exit(0);
        } catch (error) {
            console.error('Error during cleanup:', error.message);
            process.exit(1);
        }
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

// Start server
const server = app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `🚀 Server running on port ${PORT}`);
    console.log('\x1b[36m%s\x1b[0m', `📊 Health check: http://localhost:${PORT}/health`);
    console.log('\x1b[36m%s\x1b[0m', `📚 API docs: https://github.com/NathanielZee/herox-animepahe-api`);
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
    }
});

module.exports = app;