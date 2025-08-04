const express = require('express');
const Config = require('../utils/config');
const { errorHandler, CustomError } = require('../middleware/errorHandler');
const homeRoutes = require('../routes/homeRoutes');
const queueRoutes = require('../routes/queueRoutes');
const animeListRoutes = require('../routes/animeListRoutes');
const animeInfoRoutes = require('../routes/animeInfoRoutes');
const playRoutes = require('../routes/playRoutes');
const cache = require('../middleware/cache');
const redis = require('../utils/redis');

const app = express();

// Load environment variables into Config
try {
    Config.validate();
    Config.loadFromEnv();
    console.log('\x1b[36m%s\x1b[0m', 'Configuration loaded successfully');
} catch (error) {
    console.error('Configuration error:', error.message);
    // Don't exit in serverless - just continue with defaults
    console.log('Continuing with default configuration...');
}

// Health check endpoint (no cache) - Both routes work
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

app.get('/api/health', (req, res) => {
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

// DEBUG ENDPOINT - Add this for testing
app.get('/api/debug/scrape-test', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('Debug: Starting scrape test...');
        console.log('Environment variables:');
        console.log('- BASE_URL:', process.env.BASE_URL);
        console.log('- USER_AGENT:', process.env.USER_AGENT ? 'Set' : 'Not Set');
        console.log('- NODE_ENV:', process.env.NODE_ENV);
        
        // Test basic connectivity to AnimePahe
        const testUrl = process.env.BASE_URL || 'https://animepahe.ru';
        
        console.log('Debug: Testing basic fetch to:', testUrl);
        
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('Debug: Response received in', duration, 'ms');
        console.log('Debug: Status:', response.status);
        console.log('Debug: Headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        const responseSize = responseText.length;
        
        res.json({
            success: true,
            status: response.status,
            duration: duration + 'ms',
            responseSize: responseSize + ' characters',
            headers: Object.fromEntries(response.headers.entries()),
            environment: {
                BASE_URL: process.env.BASE_URL,
                USER_AGENT: process.env.USER_AGENT ? 'Set (' + process.env.USER_AGENT.substring(0, 50) + '...)' : 'Not Set',
                NODE_ENV: process.env.NODE_ENV,
                VERCEL: process.env.VERCEL ? 'true' : 'false'
            },
            // Include first 500 chars of response to see if we got HTML
            responsePreview: responseText.substring(0, 500)
        });
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.error('Debug: Error after', duration, 'ms:', error);
        
        res.json({
            success: false,
            error: error.message,
            duration: duration + 'ms',
            environment: {
                BASE_URL: process.env.BASE_URL,
                USER_AGENT: process.env.USER_AGENT ? 'Set' : 'Not Set',
                NODE_ENV: process.env.NODE_ENV,
                VERCEL: process.env.VERCEL ? 'true' : 'false'
            }
        });
    }
});

// API KEY TEST ENDPOINT - NEW ADDITION FOR TESTING API KEYS
app.get('/api/debug/api-key-test', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('Debug: Testing API keys...');
        
        const VercelProxyManager = require('../utils/vercelProxyManager');
        const manager = new VercelProxyManager();
        
        const results = await manager.testApiKeys();
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        res.json({
            success: Object.values(results).some(r => r.working),
            duration: duration + 'ms',
            results: results,
            environment: {
                scrapingbee_key_set: !!process.env.SCRAPINGBEE_API_KEY,
                scraperapi_key_set: !!process.env.SCRAPERAPI_KEY,
                scrapingbee_key_preview: process.env.SCRAPINGBEE_API_KEY ? process.env.SCRAPINGBEE_API_KEY.substring(0, 10) + '...' : 'Not set',
                scraperapi_key_preview: process.env.SCRAPERAPI_KEY ? process.env.SCRAPERAPI_KEY.substring(0, 10) + '...' : 'Not set'
            }
        });
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        res.json({
            success: false,
            error: error.message,
            duration: duration + 'ms'
        });
    }
});

// PROXY TEST ENDPOINT - NEW ADDITION FOR TESTING PROXY SERVICES
app.get('/api/debug/proxy-test', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('Debug: Starting proxy service test...');
        console.log('Environment variables:');
        console.log('- SCRAPINGBEE_API_KEY:', process.env.SCRAPINGBEE_API_KEY ? 'Set' : 'Not Set');
        console.log('- SCRAPERAPI_KEY:', process.env.SCRAPERAPI_KEY ? 'Set' : 'Not Set');
        console.log('- VERCEL:', process.env.VERCEL);
        
        const VercelProxyManager = require('../utils/vercelProxyManager');
        
        // Test with AnimePahe homepage first
        const testUrl = 'https://animepahe.ru';
        
        console.log('Debug: Testing proxy services with:', testUrl);
        
        const result = await VercelProxyManager.fetchApiData(testUrl);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('Debug: Response received in', duration, 'ms');
        console.log('Debug: Response size:', result.length, 'characters');
        
        // Check if we got actual content or DDoS-Guard page
        const isDDoSBlocked = result.includes('DDoS-Guard') || 
                             result.includes('checking your browser') ||
                             result.length < 1000;
        
        res.json({
            success: !isDDoSBlocked,
            duration: duration + 'ms',
            responseSize: result.length + ' characters',
            blocked: isDDoSBlocked,
            services: {
                scrapingbee: !!process.env.SCRAPINGBEE_API_KEY,
                scraperapi: !!process.env.SCRAPERAPI_KEY
            },
            // Include first 500 chars to verify content
            responsePreview: result.substring(0, 500),
            containsAnimepaheTitle: result.includes('animepahe') || result.includes('AnimePahe'),
            containsDDoSGuard: result.includes('DDoS-Guard')
        });
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.error('Debug: Proxy test error after', duration, 'ms:', error);
        
        res.json({
            success: false,
            error: error.message,
            duration: duration + 'ms',
            services: {
                scrapingbee: !!process.env.SCRAPINGBEE_API_KEY,
                scraperapi: !!process.env.SCRAPERAPI_KEY
            }
        });
    }
});

// STEP-BY-STEP PROXY TEST ENDPOINT - NEW DIAGNOSTIC TOOL
app.get('/api/debug/proxy-step-test', async (req, res) => {
    const results = [];
    const startTime = Date.now();
    
    try {
        const VercelProxyManager = require('../utils/vercelProxyManager');
        const manager = new VercelProxyManager();
        
        console.log('🔍 Starting step-by-step proxy testing...');
        
        // Test sites in order of difficulty
        const testSites = [
            { name: 'HTTPBin (Simple)', url: 'https://httpbin.org/get' },
            { name: 'Google (Basic)', url: 'https://www.google.com' },
            { name: 'MyAnimeList (Anime Site)', url: 'https://myanimelist.net' },
            { name: 'AnimePahe (Target)', url: 'https://animepahe.ru' }
        ];
        
        for (const site of testSites) {
            console.log(`🧪 Testing ${site.name}: ${site.url}`);
            const siteStartTime = Date.now();
            
            try {
                // Test ScrapingBee with different modes
                let scrapingbeeResult = null;
                if (manager.services.scrapingbee.enabled) {
                    try {
                        // For AnimePahe, use stealth mode
                        const isAnimePahe = site.url.includes('animepahe');
                        const data = await manager.fetchWithScrapingBee(site.url, isAnimePahe ? 'stealth' : 'basic');
                        
                        scrapingbeeResult = {
                            success: true,
                            responseLength: data.length,
                            containsDDoSGuard: data.includes('DDoS-Guard'),
                            responsePreview: data.substring(0, 100),
                            mode: isAnimePahe ? 'stealth' : 'basic'
                        };
                    } catch (error) {
                        scrapingbeeResult = {
                            success: false,
                            error: error.message,
                            status: error.response?.status
                        };
                    }
                }
                
                // Test ScraperAPI second
                let scraperapiResult = null;
                if (manager.services.scraperapi.enabled) {
                    try {
                        const data = await manager.fetchWithScraperAPI(site.url);
                        scraperapiResult = {
                            success: true,
                            responseLength: data.length,
                            containsDDoSGuard: data.includes('DDoS-Guard'),
                            responsePreview: data.substring(0, 100)
                        };
                    } catch (error) {
                        scraperapiResult = {
                            success: false,
                            error: error.message,
                            status: error.response?.status
                        };
                    }
                }
                
                const siteEndTime = Date.now();
                const siteDuration = siteEndTime - siteStartTime;
                
                results.push({
                    site: site.name,
                    url: site.url,
                    duration: siteDuration + 'ms',
                    scrapingbee: scrapingbeeResult,
                    scraperapi: scraperapiResult
                });
                
                console.log(`✅ Completed ${site.name} in ${siteDuration}ms`);
                
            } catch (error) {
                const siteEndTime = Date.now();
                const siteDuration = siteEndTime - siteStartTime;
                
                results.push({
                    site: site.name,
                    url: site.url,
                    duration: siteDuration + 'ms',
                    error: error.message
                });
                
                console.log(`❌ Failed ${site.name} after ${siteDuration}ms: ${error.message}`);
            }
        }
        
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        
        res.json({
            success: true,
            totalDuration: totalDuration + 'ms',
            results: results,
            summary: {
                sitesSuccessful: results.filter(r => !r.error).length,
                totalSites: results.length,
                services: {
                    scrapingbee: !!process.env.SCRAPINGBEE_API_KEY,
                    scraperapi: !!process.env.SCRAPERAPI_KEY
                }
            }
        });
        
    } catch (error) {
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        
        res.json({
            success: false,
            error: error.message,
            totalDuration: totalDuration + 'ms',
            results: results
        });
    }
});

// CONFIG CHECK ENDPOINT - Check what USE_PROXY affects
app.get('/api/debug/config-check', (req, res) => {
    const Config = require('../utils/config');
    
    res.json({
        environment_variables: {
            USE_PROXY: process.env.USE_PROXY,
            BASE_URL: process.env.BASE_URL,
            USER_AGENT: process.env.USER_AGENT ? 'Set' : 'Not Set',
            SCRAPINGBEE_API_KEY: process.env.SCRAPINGBEE_API_KEY ? 'Set' : 'Not Set',
            SCRAPERAPI_KEY: process.env.SCRAPERAPI_KEY ? 'Set' : 'Not Set'
        },
        config_object: {
            proxyEnabled: Config.proxyEnabled,
            baseUrl: Config.baseUrl,
            userAgent: Config.userAgent ? 'Set' : 'Not Set'
        },
        recommendations: {
            current_use_proxy: process.env.USE_PROXY,
            suggested_change: process.env.USE_PROXY === 'false' ? 'Try setting USE_PROXY=true' : 'USE_PROXY is already true'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AnimepaheAPI is running',
        endpoints: [
            'GET /health - Health check',
            'GET /api/health - Health check',
            'GET /api/debug/scrape-test - Debug scraping issues',
            'GET /api/debug/api-key-test - Test API keys validity',
            'GET /api/debug/proxy-test - Test proxy services',
            'GET /api/debug/proxy-step-test - Step-by-step proxy testing', // NEW
            'GET /api/debug/config-check - Check configuration values', // NEW
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

// API Routes with different cache durations - SAME AS APP.JS
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

// Handle uncaught exceptions - SAME AS APP.JS
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // In serverless, we can't gracefully shutdown, just log
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In serverless, we can't gracefully shutdown, just log
});

// Export for Vercel (instead of starting a server)
module.exports = app;
