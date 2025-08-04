// utils/requestManager.js - Updated to use working proxy system
const { launchBrowser } = require('./browser');
const VercelProxyManager = require('./vercelProxyManager'); // NEW: Use working proxy
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    constructor() {
        this.cookieJar = new Map();
        this.rateLimitDelay = 1000; // 1 second between requests
        this.lastRequestTime = 0;
        
        // NEW: Initialize proxy manager
        this.proxyManager = new VercelProxyManager();
        
        console.log('🔧 RequestManager initialized with proxy support');
    }

    // NEW: Smart request method that chooses the best approach
    async smartFetch(url, options = {}) {
        const startTime = Date.now();
        console.log('🚀 SmartFetch starting for:', url);
        
        // Check if we should use proxy (for Vercel environment or AnimePahe)
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
        
        // Use direct fetch (for local development or non-AnimePahe URLs)
        console.log('🌐 Using direct fetch...');
        return await this.directFetch(url, options);
    }

    // Direct fetch method (original logic)
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
                validateStatus: status => status < 500 // Accept redirects and client errors
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
            // Remove existing cookie with same name
            const filtered = domainCookies.filter(c => !c.startsWith(cookieName + '='));
            filtered.push(cookie.split(';')[0]); // Store only name=value part
            this.cookieJar.set(domain, filtered);
        });
        
        console.log(`🍪 Stored cookies for ${domain}:`, domainCookies.length);
    }

    getCookieHeader(url) {
        const domain = new URL(url).hostname;
        const cookies = this.cookieJar.get(domain) || [];
        return cookies.join('; ');
    }

    // Browser-based scraping (fallback for very complex cases)
    async browserFetch(url, options = {}) {
        console.log('🎭 Starting browser-based scraping for:', url);
        
        let browser = null;
        let page = null;
        
        try {
            browser = await launchBrowser();
            page = await browser.newPage();
            
            // Set user agent
            await page.setUserAgent(Config.userAgent);
            
            // Set cookies if available
            const cookieHeader = this.getCookieHeader(url);
            if (cookieHeader) {
                const domain = new URL(url).hostname;
                const cookies = cookieHeader.split('; ').map(cookie => {
                    const [name, value] = cookie.split('=');
                    return { name, value, domain };
                });
                await page.setCookie(...cookies);
            }
            
            // Navigate to page
            console.log('🌐 Browser navigating to:', url);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for potential DDoS-Guard challenges
            if (url.includes('animepahe')) {
                console.log('⏳ Waiting for AnimePahe to load...');
                await page.waitForTimeout(5000);
            }
            
            // Get page content
            const content = await page.content();
            console.log('✅ Browser fetch completed, content length:', content.length);
            
            return content;
            
        } catch (error) {
            console.error('❌ Browser fetch failed:', error.message);
            throw new CustomError(`Browser fetch failed: ${error.message}`, 500);
        } finally {
            if (page) await page.close();
            if (browser) await browser.close();
        }
    }

    // Main fetch method - now uses smart routing
    async fetch(url, options = {}) {
        return await this.smartFetch(url, options);
    }

    // Static method for backward compatibility
    static async fetchApiData(url, params = {}, cookieHeader = '') {
        const manager = new RequestManager();
        
        const fullUrl = new URL(url);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                fullUrl.searchParams.append(key, params[key]);
            }
        });
        
        return await manager.fetch(fullUrl.toString(), { 
            cookieHeader,
            timeout: 30000 
        });
    }

    // Additional utility methods
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxRetries} for:`, url);
                return await this.smartFetch(url, options);
            } catch (error) {
                lastError = error;
                console.error(`❌ Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }
        }
        
        throw lastError;
    }

    // Health check method
    async healthCheck() {
        try {
            const testUrl = 'https://httpbin.org/get';
            await this.smartFetch(testUrl, { timeout: 10000 });
            return { healthy: true, timestamp: new Date().toISOString() };
        } catch (error) {
            return { 
                healthy: false, 
                error: error.message, 
                timestamp: new Date().toISOString() 
            };
        }
    }
}

module.exports = RequestManager;
