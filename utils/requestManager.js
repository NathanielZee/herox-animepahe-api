// utils/requestManager.js - Enhanced version with DDoS-Guard bypass
const { launchBrowser } = require('./browser');
const cheerio = require('cheerio');
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    constructor() {
        this.sessions = new Map(); // Store cookies per session
        this.rateLimiter = new Map(); // Track request timing
        this.lastRequestTime = 0;
    }

    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate realistic browser fingerprint
    static getBrowserHeaders(cookieHeader = '') {
        const headers = {
            'User-Agent': Config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };

        if (cookieHeader) {
            headers['Cookie'] = cookieHeader;
        }

        return headers;
    }

    // Enhanced DDoS-Guard bypass with multiple strategies
    static async bypassDDoSGuard(url, cookieHeader, maxRetries = 3) {
        console.log(`🛡️ Attempting DDoS-Guard bypass for: ${url}`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Bypass attempt ${attempt}/${maxRetries}`);
                
                // Strategy 1: Enhanced headers with delays
                const result = await this.fetchWithEnhancedHeaders(url, cookieHeader);
                
                // Check if we got through
                if (!this.isDDoSGuardBlocked(result)) {
                    console.log(`✅ DDoS-Guard bypass successful on attempt ${attempt}`);
                    return result;
                }
                
                // Strategy 2: Use Playwright for JavaScript challenges
                if (attempt === 2) {
                    console.log(`🎭 Trying Playwright approach...`);
                    const playwrightResult = await this.scrapeWithPlaywright(url);
                    
                    if (!this.isDDoSGuardBlocked(playwrightResult)) {
                        console.log(`✅ Playwright bypass successful`);
                        return playwrightResult;
                    }
                }
                
                // Progressive delays between attempts
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
                console.log(`⏳ Waiting ${delay}ms before next attempt...`);
                await this.delay(delay);
                
            } catch (error) {
                console.error(`❌ Bypass attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    throw error;
                }
            }
        }
        
        throw new CustomError('DDoS-Guard bypass failed after all attempts', 403);
    }

    // Check if response is blocked by DDoS-Guard
    static isDDoSGuardBlocked(content) {
        if (!content) return true;
        
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        
        return contentStr.includes('DDoS-GUARD') ||
               contentStr.includes('ddos-guard') ||
               contentStr.includes('checking your browser') ||
               contentStr.includes('challenge') ||
               contentStr.length < 1000; // Suspiciously short content
    }

    // Enhanced fetch with better headers and timing
    static async fetchWithEnhancedHeaders(url, cookieHeader) {
        // Rate limiting - ensure minimum delay between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = 1000; // 1 second minimum between requests
        
        if (timeSinceLastRequest < minDelay) {
            await this.delay(minDelay - timeSinceLastRequest);
        }
        
        this.lastRequestTime = Date.now();

        const headers = this.getBrowserHeaders(cookieHeader);
        
        // Add referrer for internal pages
        if (url.includes('/api/') || url.includes('/play/') || url.includes('/anime/')) {
            headers['Referer'] = Config.getUrl('home');
        }

        const requestConfig = {
            headers,
            timeout: 20000, // 20 second timeout
            validateStatus: (status) => status < 500,
            maxRedirects: 5,
            decompress: true
        };

        // Add proxy if enabled
        if (Config.proxyEnabled) {
            const proxyUrl = Config.getRandomProxy();
            if (proxyUrl) {
                const [host, port] = proxyUrl.replace(/^https?:\/\//, '').split(':');
                requestConfig.proxy = {
                    host: host,
                    port: parseInt(port),
                    protocol: 'http'
                };
                console.log(`🔄 Using proxy: ${proxyUrl}`);
            }
        }

        const response = await axios.get(url, requestConfig);
        
        // Enhanced error handling
        if (response.status === 403) {
            throw new CustomError('Access forbidden - DDoS protection active', 403);
        }
        
        if (response.status === 404) {
            throw new CustomError('Resource not found', 404);
        }
        
        if (response.status >= 400) {
            throw new CustomError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }

        return response.data;
    }

    // Retry with exponential backoff and DDoS-Guard handling
    static async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (error?.response?.status === 404 || 
                    error?.response?.status === 401) {
                    throw error;
                }
                
                // Special handling for DDoS-Guard
                if (error?.response?.status === 403 || 
                    (error.message && error.message.includes('DDoS'))) {
                    console.log(`🛡️ DDoS-Guard detected, using bypass strategies...`);
                    // This will be handled by the bypass function
                }
                
                if (attempt === maxRetries) {
                    console.error(`❌ All ${maxRetries} attempts failed. Last error:`, error.message);
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`⏳ Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this.delay(delay);
            }
        }
        
        throw lastError;
    }

    static async fetch(url, cookieHeader, type = 'default') {
        return this.retry(async () => {
            // Always try DDoS-Guard bypass first for AnimePahe URLs
            if (url.includes('animepahe.ru')) {
                return await this.bypassDDoSGuard(url, cookieHeader);
            }
            
            if (type === 'default') {
                return this.fetchApiData(url, {}, cookieHeader);
            } else if (type === 'heavy') {
                return this.scrapeWithPlaywright(url);
            } else {
                throw new Error('Invalid fetch type specified. Please use "default" or "heavy".');
            }
        }, 3, 1000);
    }

    static async scrapeWithPlaywright(url) {
        console.log('🎭 Using Playwright for:', url);
        
        let browser = null;
        let context = null;
        let page = null;

        try {
            browser = await Promise.race([
                launchBrowser(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Browser launch timeout')), 30000)
                )
            ]);

            const contextOptions = {
                userAgent: Config.userAgent,
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: this.getBrowserHeaders()
            };

            if (Config.proxyEnabled) {
                const proxy = Config.getRandomProxy();
                if (proxy) {
                    contextOptions.proxy = { server: proxy };
                }
            }

            context = await browser.newContext(contextOptions);
            context.setDefaultTimeout(60000);
            context.setDefaultNavigationTimeout(60000);

            page = await context.newPage();

            // Enhanced stealth measures
            await page.addInitScript(() => {
                // Remove webdriver property
                delete navigator.__proto__.webdriver;
                
                // Override plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // Override languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Override permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            });

            console.log('🚀 Navigating to URL...');
            
            await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: 45000 
            });

            // Handle DDoS-Guard challenges
            const title = await page.title();
            if (title.includes('DDoS') || title.includes('Guard')) {
                console.log('🛡️ DDoS-Guard challenge detected, waiting for bypass...');
                
                try {
                    // Wait for challenge to complete
                    await page.waitForFunction(
                        () => !document.title.includes('DDoS') && !document.body.innerHTML.includes('checking'),
                        { timeout: 30000 }
                    );
                    console.log('✅ DDoS-Guard challenge completed');
                } catch (e) {
                    console.log('⏰ Challenge timeout, proceeding with current content...');
                }
            }

            // Additional wait for dynamic content
            await this.delay(3000);

            const finalContent = await page.content();
            
            if (finalContent.length < 1000) {
                throw new Error('Page content too short, might be blocked');
            }

            return finalContent;

        } catch (error) {
            console.error('❌ Playwright error:', error.message);
            throw new CustomError(`Playwright failed: ${error.message}`, 503);
        } finally {
            try {
                if (page) await page.close();
                if (context) await context.close();
                if (browser) await browser.close();
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
            }
        }
    }

    static async fetchApiData(url, params = {}, cookieHeader) {
        // For API endpoints, use the enhanced bypass
        if (url.includes('animepahe.ru')) {
            return await this.bypassDDoSGuard(url, cookieHeader);
        }
        
        if (!cookieHeader) {
            throw new CustomError('Authentication required', 403);
        }
        
        try {
            const requestConfig = {
                params: params,
                headers: this.getBrowserHeaders(cookieHeader),
                timeout: 20000,
                validateStatus: (status) => status < 500
            };

            if (Config.proxyEnabled) {
                const proxyUrl = Config.getRandomProxy();
                if (proxyUrl) {
                    const [host, port] = proxyUrl.replace(/^https?:\/\//, '').split(':');
                    requestConfig.proxy = {
                        host: host,
                        port: parseInt(port),
                        protocol: 'http'
                    };
                }
            }

            const response = await axios.get(url, requestConfig);

            if (this.isDDoSGuardBlocked(response.data)) {
                throw new CustomError('DDoS-Guard protection detected', 403);
            }

            if (response.status === 404) {
                throw new CustomError('Resource not found', 404);
            }

            if (response.status >= 400) {
                throw new CustomError(`HTTP ${response.status}: ${response.statusText}`, response.status);
            }

            return response.data;

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new CustomError('Request timeout', 408);
            }
            
            if (error.code === 'ECONNREFUSED') {
                throw new CustomError('Connection refused', 503);
            }

            if (error instanceof CustomError) {
                throw error;
            }

            throw new CustomError(`Request failed: ${error.message}`, error.response?.status || 503);
        }
    }

    static async fetchJson(url) {
        return this.retry(async () => {
            const html = await this.fetch(url);
            
            try {
                const jsonMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) || 
                                 html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[1].trim());
                } else {
                    return JSON.parse(html);
                }
            } catch (parseError) {
                throw new Error(`Failed to parse JSON from ${url}: ${parseError.message}`);
            }
        }, 2, 2000);
    }
}

// Create singleton instance
const requestManager = new RequestManager();

module.exports = RequestManager;
