const redisClient = require('../utils/redis');

const cache = (duration) => async (req, res, next) => {
    try {
        const key = req.originalUrl;
        const cachedResponse = await redisClient.get(key);

        if (cachedResponse) {
            return res.json(JSON.parse(cachedResponse));
        }

        const originalJson = res.json;
        
        // Override res.json method
        res.json = async function(data) {
            // Store the response in Redis before sending
            await redisClient.setEx(key, duration, JSON.stringify(data));
            
            // Call the original res.json with the data
            return originalJson.call(this, data);
        };

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = cache;