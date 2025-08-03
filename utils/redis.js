const Redis = require('redis');

// Check if Redis should be enabled
const REDIS_ENABLED = !!process.env.REDIS_URL;

let redisClient = null;
let isRedisHealthy = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

if (REDIS_ENABLED) {
    redisClient = Redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => {
                // Stop trying after max attempts
                if (retries > MAX_RECONNECT_ATTEMPTS) {
                    console.log('Redis: Max reconnection attempts reached, switching to fallback mode');
                    isRedisHealthy = false;
                    return false; // Stop trying
                }
                
                const delay = Math.min(retries * 1000, 10000); // Max 10 seconds
                console.log(`Redis: Retrying connection in ${delay}ms (attempt ${retries})`);
                return delay;
            },
            connectTimeout: 10000, // 10 seconds max to connect
            commandTimeout: 5000   // 5 seconds max for commands
        }
    });

    redisClient.on('connect', () => {
        console.log('\x1b[32m%s\x1b[0m', 'Redis Client Connected');
        isRedisHealthy = true;
        reconnectAttempts = 0;
    });

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
        isRedisHealthy = false;
        reconnectAttempts++;
    });

    redisClient.on('end', () => {
        console.log('Redis connection ended');
        isRedisHealthy = false;
    });

    // Connect to Redis with error handling
    (async () => {
        try {
            await redisClient.connect();
        } catch (error) {
            console.error('Redis initial connection failed:', error.message);
            console.log('API will work without Redis caching');
            isRedisHealthy = false;
        }
    })();

    // Health check every 30 seconds
    setInterval(async () => {
        if (!isRedisHealthy && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            try {
                if (!redisClient.isOpen) {
                    await redisClient.connect();
                }
            } catch (error) {
                console.log('Redis health check failed, continuing without cache');
            }
        }
    }, 30000);
}

// Safe get with fallback
const get = async (key) => {
    // If Redis is disabled or unhealthy, return null (no cache)
    if (!REDIS_ENABLED || !isRedisHealthy) {
        return null;
    }

    try {
        const result = await Promise.race([
            redisClient.get(key),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis timeout')), 3000)
            )
        ]);
        return result;
    } catch (error) {
        console.error('Redis get error:', error.message);
        isRedisHealthy = false;
        return null; // Fallback to no cache
    }
};

// Safe set with fallback
const setEx = async (key, duration, value) => {
    // If Redis is disabled or unhealthy, just continue without caching
    if (!REDIS_ENABLED || !isRedisHealthy) {
        return;
    }

    try {
        await Promise.race([
            redisClient.setEx(key, duration, value),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis timeout')), 3000)
            )
        ]);
    } catch (error) {
        console.error('Redis setEx error:', error.message);
        isRedisHealthy = false;
        // Don't throw error, just continue without caching
    }
};

// Health check function
const isHealthy = () => {
    return REDIS_ENABLED ? isRedisHealthy : true; // Always healthy if not using Redis
};

// Graceful shutdown
const disconnect = async () => {
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.disconnect();
            console.log('Redis disconnected gracefully');
        } catch (error) {
            console.error('Error disconnecting Redis:', error.message);
        }
    }
};

module.exports = {
    redisClient,
    get,
    setEx,
    enabled: REDIS_ENABLED,
    isHealthy,
    disconnect
};