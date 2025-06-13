const redis = require('../utils/redis');

const cache = (duration) => async (req, res, next) => {
    // caching will be skipped if Redis is disabled
    if (!redis.enabled) {
        return next();
    }

    try {
        const key = req.originalUrl;
        const cachedResponse = await redis.get(key);

        if (cachedResponse) {
            return res.json(JSON.parse(cachedResponse));
        }

        const originalJson = res.json;
        
        res.json = async function(data) {
            await redis.setEx(key, duration, JSON.stringify(data));
            return originalJson.call(this, data);
        };

        next();
    } catch (error) {
        console.error('Cache error:', error);
        next();
    }
};

module.exports = cache;