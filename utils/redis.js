const Redis = require('redis');

// Check if Redis should be enabled
const REDIS_ENABLED = !!process.env.REDIS_URL;

let redisClient = null;

if (REDIS_ENABLED) {
    redisClient = Redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.log('Max reconnection attempts reached');
                    return new Error('Max reconnection attempts reached');
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
    });

    // Connect to Redis
    (async () => {
        try {
            await redisClient.connect();
            console.log('\x1b[32m%s\x1b[0m', 'Redis Client Connected');
        } catch (error) {
            console.error('Redis connection failed:', error.message);
        }
    })();
}

const get = async (key) => {
    if (!REDIS_ENABLED) return null;
    try {
        return await redisClient.get(key);
    } catch (error) {
        console.error('Redis get error:', error.message);
        return null;
    }
};

const setEx = async (key, duration, value) => {
    if (!REDIS_ENABLED) return;
    try {
        await redisClient.setEx(key, duration, value);
    } catch (error) {
        console.error('Redis setEx error:', error.message);
    }
};

module.exports = {
    redisClient,
    get,
    setEx,
    enabled: REDIS_ENABLED
};