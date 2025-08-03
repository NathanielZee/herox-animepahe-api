const redis = require('../utils/redis');

const cache = (duration) => async (req, res, next) => {
    // Always continue even if Redis is disabled or broken
    if (!redis.enabled || !redis.isHealthy()) {
        console.log('Cache disabled or unhealthy, skipping cache');
        return next();
    }

    try {
        const key = req.originalUrl;
        
        // Try to get cached data with timeout
        const cachedResponse = await Promise.race([
            redis.get(key),
            new Promise((resolve) => setTimeout(() => resolve(null), 2000)) // 2 second timeout
        ]);

        if (cachedResponse) {
            console.log(`Cache HIT for: ${key}`);
            try {
                return res.json(JSON.parse(cachedResponse));
            } catch (parseError) {
                console.error('Error parsing cached data:', parseError.message);
                // Continue without cache if parsing fails
            }
        }

        console.log(`Cache MISS for: ${key}`);

        // Override res.json to cache the response
        const originalJson = res.json;
        
        res.json = async function(data) {
            // Try to cache the response, but don't fail if it doesn't work
            try {
                await Promise.race([
                    redis.setEx(key, duration, JSON.stringify(data)),
                    new Promise((resolve) => setTimeout(resolve, 3000)) // 3 second timeout
                ]);
                console.log(`Cached response for: ${key}`);
            } catch (cacheError) {
                console.error('Error caching response:', cacheError.message);
                // Don't throw error, just continue without caching
            }
            
            return originalJson.call(this, data);
        };

        next();
        
    } catch (error) {
        console.error('Cache middleware error:', error.message);
        // Never let cache errors break the request
        next();
    }
};

module.exports = cache;