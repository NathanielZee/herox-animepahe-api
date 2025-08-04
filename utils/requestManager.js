// utils/requestManager.js - Updated to use professional proxy services
const { launchBrowser } = require('./browser');
const VercelProxyManager = require('./vercelProxyManager');
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    constructor() {
        this.sessions = new Map();
        this.rateLimiter = new Map();
        this.lastRequestTime = 0;
        this.useProxy = process.env.VERCEL === 'true'; // Use proxy on Vercel
    }

    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

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

    async fetchWithProxy(url, cookieHeader) {
        console.log('🌐 Using professional proxy service for:', url);
        
        try {
            return await VercelProxyManager.fetchApiData(url, {}, cookieHeader);
        } catch (error) {
            console.error('❌ Proxy service failed:', error.message);
            throw error;
        }
    }

    async fetchDirect(url, cookieHeader) {
        console.log('🔗 Direct fetch for:', url);
        
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = 1000;
        
        if (timeSinceLastRequest < minDelay) {
            await RequestManager.delay(minDelay - timeSinceLastRequest);
        }
        
        this.lastRequestTime = Date.now();

        const headers = RequestManager.getBrowserHeaders(cookieHeader);
        
        if (url.includes('/api/') || url.includes('/play/') || url.includes('/anime/')) {
            headers['Referer'] = Config.getUrl('home');
        }

        const requestConfig = {
            headers,
            timeout: 20000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5,
            decompress: true
        };

        const response = await axios.get(url, requestConfig);
        
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
                await this.delay(delay);
            }
        }
        
        throw lastError;
    }

    static async fetch(url, cookieHeader, type = 'default') {
        const instance = new RequestManager();
        
        return this.retry(async () => {
            // Use proxy for animepahe.ru on Vercel, direct elsewhere
            if (url.includes('animepahe.ru') && instance.useProxy) {
                return await instance.fetchWithProxy(url, cookieHeader);
            }
            
            if (type === 'heavy') {
                return instance.scrapeWithPlaywright(url);
            }
            
            return await instance.fetchDirect(url, cookieHeader);
        }, 3, 1000);
    }

    async scrapeWithPlaywright(url) {
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
                extraHTTPHeaders: RequestManager.getBrowserHeaders()
            };

            context = await browser.newContext(contextOptions);
            context.setDefaultTimeout(60000);
            context.setDefaultNavigationTimeout(60000);

            page = await context.newPage();

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

    static async fetchApiData(url, params = {}, cookieHeader) {
        const instance = new RequestManager();
        
        try {
            const fullUrl = new URL(url);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    fullUrl.searchParams.append(key, params[key]);
                }
            });
            
            if (fullUrl.href.includes('animepahe.ru') && instance.useProxy) {
                return await instance.fetchWithProxy(fullUrl.href, cookieHeader);
            }
            
            return await instance.fetchDirect(fullUrl.href, cookieHeader);
            
        } catch (error) {
            if (error instanceof CustomError) {
                throw error;
            }
            throw new CustomError(`API request failed: ${error.message}`, error.response?.status || 503);
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

module.exports = RequestManager;
