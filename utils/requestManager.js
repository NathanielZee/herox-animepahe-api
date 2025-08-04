// utils/requestManager.js - Fixed with static methods for backward compatibility
const { launchBrowser } = require('./browser');
const VercelProxyManager = require('./vercelProxyManager');
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    constructor() {
        this.cookieJar = new Map();
        this.rateLimitDelay = 1000;
        this.lastRequestTime = 0;
        this.proxyManager = new VercelProxyManager();
    }

    // Static instance for shared usage
    static _instance = null;
    static getInstance() {
        if (!this._instance) {
            this._instance = new RequestManager();
        }
        return this._instance;
    }

    // FIXED: Make this static and delegate to instance
    static async fetch(url, cookieHeader, type = 'default') {
        const instance = this.getInstance();
        return await instance.smartFetch(url, { cookieHeader, type });
    }

    // FIXED: Make this static for backward compatibility
    static async fetchApiData(url, params = {}, cookieHeader = '') {
        const instance = this.getInstance();
        
        const fullUrl = new URL(url);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                fullUrl.searchParams.append(key, params[key]);
            }
        });
        
        return await instance.smartFetch(fullUrl.toString(), { 
            cookieHeader,
            timeout: 30000 
        });
    }

    // FIXED: Make this static
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

    // FIXED: Make retry static
    static async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (error?.response?.status === 404 || 
                    error?.response?.status === 401) {
                    throw error;
                }
                
                if (attempt === maxRetries) {
                    console.error(`❌ All ${maxRetries} attempts failed. Last error:`, error.message);
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`⏳ Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    // FIXED: Make delay static
    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Instance method: Smart fetch with proxy logic
    async smartFetch(url, options = {}) {
        const startTime = Date.now();
        console.log('🚀 SmartFetch starting for:', url);
        
        // Check if we should use proxy
        const isVercel = process.env.VERCEL === '1';
        const isAnimePahe = url.includes('animepahe');
        const shouldUseProxy = isVercel && isAnimePahe;
        
        console.log('🔍 Environment check:', {
            isVercel,
            isAnimePahe,
            shouldUseProxy,
            hasProxyKeys: !!(process.env.SCRAPINGBEE_API_KEY || process.env.SCRAPERAPI_KEY)
        });
        
        if (shouldUseProxy && (process.env.SCRAPINGBEE_API_KEY || process.env.SCRAPERAPI_KEY)) {
            console.log('🔄 Using proxy services for AnimePahe...');
            try {
                const result = await this.proxyManager.fetch(url, options.cookieHeader || '');
                const duration = Date.now() - startTime;
                console.log(`✅ Proxy fetch successful in ${duration}ms`);
                return result;
            } catch (error) {
                console.error('❌ Proxy fetch failed:', error.message);
                console.log('🔄 Falling back to direct fetch...');
                // Fall through to direct fetch
            }
        }
        
        // Use direct fetch
        console.log('🌐 Using direct fetch...');
        return await this.directFetch(url, options);
    }

    // Instance method: Direct fetch
    async directFetch(url, options = {}) {
        const startTime = Date.now();
        
        try {
            // Rate limiting
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < this.rateLimitDelay) {
                const waitTime = this.rateLimitDelay - timeSinceLastRequest;
                console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            this.lastRequestTime = Date.now();

            const headers = {
                'User-Agent': Config.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers
            };

            if (options.cookieHeader) {
                headers['Cookie'] = options.cookieHeader;
            }

            console.log('🌐 Direct fetch to:', url);
            
            const response = await axios.get(url, {
                headers,
                timeout: options.timeout || 30000,
                maxRedirects: 5,
                validateStatus: status => status < 500
            });

            const duration = Date.now() - startTime;
            console.log(`✅ Direct fetch completed in ${duration}ms`);

            // Store cookies if present
            if (response.headers['set-cookie']) {
                this.storeCookies(url, response.headers['set-cookie']);
            }

            return response.data;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Direct fetch failed after ${duration}ms:`, error.message);
            
            if (error.response?.status === 403 || error.response?.data?.includes('DDoS-Guard')) {
                throw new CustomError(`Access blocked by DDoS-Guard protection: ${error.message}`, 403);
            }
            
            throw new CustomError(`Request failed: ${error.message}`, error.response?.status || 500);
        }
    }

    // Cookie management
    storeCookies(url, cookies) {
        const domain = new URL(url).hostname;
        if (!this.cookieJar.has(domain)) {
            this.cookieJar.set(domain, []);
        }
        
        const domainCookies = this.cookieJar.get(domain);
        cookies.forEach(cookie => {
            const cookieName = cookie.split('=')[0];
            const filtered = domainCookies.filter(c => !c.startsWith(cookieName + '='));
            filtered.push(cookie.split(';')[0]);
            this.cookieJar.set(domain, filtered);
        });
        
        console.log(`🍪 Stored cookies for ${domain}:`, domainCookies.length);
    }

    getCookieHeader(url) {
        const domain = new URL(url).hostname;
        const cookies = this.cookieJar.get(domain) || [];
        return cookies.join('; ');
    }

    // Browser-based scraping fallback
    async scrapeWithPlaywright(url) {
        console.log('🎭 Starting browser-based scraping for:', url);
        
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
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            };

            context = await browser.newContext(contextOptions);
            context.setDefaultTimeout(60000);
            context.setDefaultNavigationTimeout(60000);

            page = await context.newPage();

            // Enhanced stealth measures
            await page.addInitScript(() => {
                delete navigator.__proto__.webdriver;
                
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
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
                    await page.waitForFunction(
                        () => !document.title.includes('DDoS') && !document.body.innerHTML.includes('checking'),
                        { timeout: 30000 }
                    );
                    console.log('✅ DDoS-Guard challenge completed');
                } catch (e) {
                    console.log('⏰ Challenge timeout, proceeding with current content...');
                }
            }

            await RequestManager.delay(3000);
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
}

module.exports = RequestManager;
