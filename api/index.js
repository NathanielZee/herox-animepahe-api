const express = require('express');
const Config = require('../utils/config');
const { errorHandler } = require('../middleware/errorHandler');
const homeRoutes = require('../routes/homeRoutes');
const queueRoutes = require('../routes/queueRoutes');
const animeListRoutes = require('../routes/animeListRoutes');
const animeInfoRoutes = require('../routes/animeInfoRoutes');
const playRoutes = require('../routes/playRoutes');

const app = express();

// Load environment variables into Config
try {
    Config.validate();
    Config.loadFromEnv();
    console.log('\x1b[36m%s\x1b[0m', 'Configuration set!.');
} catch (error) {
    console.error(error.message);
    // Don't process.exit(1) in serverless - just throw
    throw error;
}

// Middleware to set hostUrl ONCE based on first incoming request
app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.url}`);
    const protocol = req.protocol || 'https'; // Default to https on Vercel
    const host = req.headers.host;
    Config.setHostUrl(protocol, host);
    next();
});

// Use Routes - Remove '/api' prefix since we're already in /api
app.use('/', homeRoutes);
app.use('/', queueRoutes);
app.use('/', animeListRoutes);
app.use('/', animeInfoRoutes);
app.use('/', playRoutes);

// Error handling middleware
app.use(errorHandler);

// Export for Vercel (no app.listen in serverless)
module.exports = app;