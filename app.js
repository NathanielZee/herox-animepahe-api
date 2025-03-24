const express = require('express');
const Config = require('./utils/config');
const homeRoutes = require('./routes/homeRoutes');
const queueRoutes = require('./routes/queueRoutes');
const animeInfoRoutes = require('./routes/animeInfoRoutes');

const app = express();

try {
    Config.validate();
    console.log('Configuration is valid.');
} catch (error) {
    console.error(error.message);
    process.exit(1); // Exit if configuration is invalid
}

// Use Routes
app.use('/api', homeRoutes);
app.use('/api', queueRoutes);
app.use('/api', animeInfoRoutes);

const PORT =  process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});