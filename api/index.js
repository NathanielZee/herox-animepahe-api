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
    throw error;
}

// Middleware to set hostUrl
app.use((req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    Config.setHostUrl(protocol, host);
    next();
});

// Mount routes WITHOUT /api prefix (since we're already in /api)
app.use('/', homeRoutes);
app.use('/', queueRoutes);
app.use('/', animeListRoutes);
app.use('/', animeInfoRoutes);
app.use('/', playRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app.handler = (req, res) => {
    req.url = req.url.replace(/^\/api/, '');
    return app(req, res);
};