const express = require('express');
const Config = require('./utils/config');
const { errorHandler, CustomError } = require('./middleware/errorHandler');
const homeRoutes = require('./routes/homeRoutes');
const queueRoutes = require('./routes/queueRoutes');
const animeListRoutes = require('./routes/animeListRoutes');
const animeInfoRoutes = require('./routes/animeInfoRoutes');
const playRoutes = require('./routes/playRoutes');

const app = express();

// Load environment variables into Config

try {
    Config.validate();
    Config.loadFromEnv();
    console.log('\x1b[36m%s\x1b[0m', 'Configuration set!.'); // Just wanted to try adding colors
} catch (error) {
    console.error(error.message);
    process.exit(1); 
}

// Middleware to set hostUrl ONCE based on first incoming request
app.use((req, res, next) => {
    const protocol = req.protocol;
    const host = req.headers.host;
    Config.setHostUrl(protocol, host);
    next();
});

// Use Routes
app.use('/api', homeRoutes);
app.use('/api', queueRoutes);
app.use('/api', animeListRoutes);
app.use('/api', animeInfoRoutes);
app.use('/api', playRoutes);

// 404 handler - This should be after all routes
app.use((req, res, next) => {
    next(new CustomError('Route not found. Please check the API documentation at https://github.com/ElijahCodes12345/animepahe-api', 404));
});

// Error handling middleware
app.use(errorHandler);

const PORT =  process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});