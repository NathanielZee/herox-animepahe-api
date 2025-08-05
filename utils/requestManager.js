// utils/requestManager.js - Ultra-Strong DDoS-Guard Bypass System
const { launchBrowser } = require('./browser');
const cheerio = require('cheerio');
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    constructor() {
        this.sessionCookies = new Map();
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0'
        ];
        this.currentUA = this.getRandomUserAgent();
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.ddosGuardSessions = new Map();
    }

    // Static instance for backward compatibility
    static _instance = null;
    static getInstance() {
        if (!this._instance) {
            this._instance = new RequestManager();
        }
        return this._instance;
    }

    // Static methods for backward compatibility
    static async fetch(url, cookieHeader, type = 'default') {
        const instance = this.getInstance();
        return await instance.smartFetch(url, { cookieHeader, type });
    }

    static async fetchApiData(url, params = {}, cookieHeader = '') {
        const instance = this.getInstance();
        const fullUrl = new URL(url);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                fullUrl.searchParams.append(key, params[key]);
            }
        });
        return await instance.smartFetch(fullUrl.toString(), { cookieHeader });
    }

    static async fetchJson(url) {
        const instance = this.getInstance();
        const html = await instance.smartFetch(url);
        
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
    }

    // Instance methods that mirror static ones for compatibility
    async fetch(url, cookieHeader, type = 'default') {
        return await this.smartFetch(url, { cookieHeader, type });
    }

    async fetchApiData(url, params = {}, cookieHeader = '') {
        const fullUrl = new URL(url);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                fullUrl.searchParams.append(key, params[key]);
            }
        });
        return await this.smartFetch(fullUrl.toString(), { cookieHeader });
    }

    async fetchJson(url) {
        const html = await this.smartFetch(url);
        
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
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    rotateSession() {
        this.currentUA = this.getRandomUserAgent();
        this.requestCount = 0;
        console.log('🔄 Session rotated - New UA:', this.currentUA.substring(0, 50) + '...');
    }

    // Advanced DDoS-Guard detection
    isDDoSGuardChallenge(html, url) {
        if (!html || typeof html !== 'string') return true;
        
        const domain = new URL(url).hostname;
        
        // Comprehensive DDoS-Guard indicators
        const ddosIndicators = [
            'DDoS-Guard',
            'ddos-guard',
            'checking your browser',
            'please wait while we verify',
            'verifying you are human',
            'browser verification',
            'security check',
            'anti-bot verification',
            'challenge-platform',
            'cf-challenge',
            'ray id:',
            'cloudflare',
            'just a moment',
            'enable javascript and cookies',
            'this process is automatic',
            'please allow up to 5 seconds',
            'ddos protection by',
            '__cf_bm',
            '_cfuvid',
            'cf_clearance'
        ];

        const lowerHtml = html.toLowerCase();
        const hasIndicators = ddosIndicators.some(indicator => 
            lowerHtml.includes(indicator.toLowerCase())
        );

        // Check for challenge page patterns
        const challengePatterns = [
            /<title[^>]*>(?:just a moment|checking|verifying|ddos|guard|security)/i,
            /window\._cf_chl_/i,
            /ddosguard/i,
            /challenge-form/i,
            /check.*browser/i
        ];

        const hasPatterns = challengePatterns.some(pattern => pattern.test(html));

        // Check response length (challenge pages are usually short)
        const isShortResponse = html.length < 2000 && !html.includes('<!DOCTYPE html>');
        
        // Check for actual content indicators
        const hasRealContent = html.includes('<main>') || 
                              html.includes('class="content"') ||
                              html.includes('animepahe') ||
                              html.length > 10000;

        const isBlocked = (hasIndicators || hasPatterns || isShortResponse) && !hasRealContent;
        
        if (isBlocked) {
            console.log(`🚫 DDoS-Guard challenge detected for ${domain}:`, {
                hasIndicators,
                hasPatterns,
                isShortResponse,
                responseLength: html.length,
                hasRealContent
            });
        }

        return isBlocked;
    }

    // Enhanced headers with fingerprint randomization
    generateStealthHeaders(url, cookies = '') {
        const domain = new URL(url).hostname;
        
        // Rotate UA every 20 requests
        if (this.requestCount % 20 === 0) {
            this.rotateSession();
        }
        
        const headers = {
            'User-Agent': this.currentUA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Pragma': 'no-cache'
        };

        // Add Chrome-specific headers
        if (this.currentUA.includes('Chrome')) {
            headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = '"Windows"';
        }

        // Add appropriate referer
        if (domain.includes('animepahe')) {
            headers['Referer'] = 'https://animepahe.ru/';
            headers['Origin'] = 'https://animepahe.ru';
        } else if (domain.includes('kwik')) {
            headers['Referer'] = 'https://animepahe.ru/';
            headers['Origin'] = 'https://kwik.si';
        }

        // Add session cookies
        if (cookies) {
            headers['Cookie'] = cookies;
        } else if (this.sessionCookies.has(domain)) {
            headers['Cookie'] = this.sessionCookies.get(domain);
        }

        this.requestCount++;
        return headers;
    }

    // Intelligent delay system
    async smartDelay(attempt = 1) {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        const baseDelay = Math.max(800 + Math.random() * 400, 1200 - timeSinceLastRequest);
        
        // Exponential backoff for retries
        const retryMultiplier = Math.pow(1.5, attempt - 1);
        const delay = Math.min(baseDelay * retryMultiplier, 8000);
        
        if (delay > 0) {
            console.log(`⏱️ Smart delay: ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
    }

    // Super-enhanced axios request with anti-detection
    async enhancedAxiosRequest(url, options = {}) {
        const domain = new URL(url).hostname;
        const cookies = options.cookieHeader || '';
        
        const headers = this.generateStealthHeaders(url, cookies);
        
        const axiosConfig = {
            method: 'GET',
            url: url,
            headers: {
                ...headers,
                ...options.headers
            },
            timeout: 25000,
            maxRedirects: 8,
            validateStatus: (status) => status < 500,
            ...options.axiosConfig
        };

        try {
            const response = await axios(axiosConfig);
            
            // Store cookies from response
            if (response.headers['set-cookie']) {
                const cookieHeader = response.headers['set-cookie']
                    .map(cookie => cookie.split(';')[0])
                    .join('; ');
                this.sessionCookies.set(domain, cookieHeader);
                console.log(`🍪 Stored cookies for ${domain}`);
            }

            return {
                data: response.data,
                status: response.status,
                headers: response.headers
            };
            
        } catch (error) {
            if (error.response) {
                return {
                    data: error.response.data,
                    status: error.response.status,
                    headers: error.response.headers,
                    error: error.message
                };
            }
            throw error;
        }
    }

    // Ultimate DDoS-Guard solver using browser automation
    async solveDDoSGuardChallenge(url, options = {}) {
        console.log('🛡️ Starting DDoS-Guard challenge solver for:', url);
        
        let browser = null;
        let context = null;
        let page = null;

        try {
            // Launch browser with enhanced stealth
            browser = await launchBrowser();
            
            const contextOptions = {
                userAgent: this.currentUA,
                viewport: { 
                    width: 1366 + Math.floor(Math.random() * 200), 
                    height: 768 + Math.floor(Math.random() * 200) 
                },
                extraHTTPHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                // Add some entropy to avoid detection
                locale: 'en-US',
                timezoneId: 'America/New_York'
            };

            context = await browser.newContext(contextOptions);
            context.setDefaultTimeout(45000);
            
            page = await context.newPage();

            // Ultra-stealth browser setup
            await page.addInitScript(() => {
                // Remove webdriver traces
                delete navigator.__proto__.webdriver;
                
                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', length: 1 },
                        { name: 'Chrome PDF Viewer', length: 1 },
                        { name: 'Native Client', length: 1 }
                    ],
                });
                
                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Mock webgl
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel(R) HD Graphics';
                    return getParameter.apply(this, arguments);
                };
                
                // Mock chrome runtime
                window.chrome = { runtime: {} };
                
                // Add realistic screen properties
                Object.defineProperty(screen, 'availWidth', { value: 1366 });
                Object.defineProperty(screen, 'availHeight', { value: 728 });
            });

            console.log('🚀 Navigating to target URL...');
            
            // Navigate with realistic timing
            await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Check for challenge immediately
            let challengeDetected = false;
            try {
                const title = await page.title();
                const bodyText = await page.textContent('body').catch(() => '');
                
                challengeDetected = title.toLowerCase().includes('ddos') ||
                                  title.toLowerCase().includes('guard') ||
                                  title.toLowerCase().includes('checking') ||
                                  bodyText.toLowerCase().includes('ddos-guard') ||
                                  bodyText.toLowerCase().includes('checking your browser');
                
                console.log('🔍 Challenge detection:', {
                    title: title.substring(0, 100),
                    challengeDetected,
                    bodyTextLength: bodyText.length
                });
                
            } catch (e) {
                console.log('⚠️ Could not check for challenge immediately');
            }

            if (challengeDetected) {
                console.log('🛡️ DDoS-Guard challenge confirmed - executing human-like solver...');
                
                // Human-like behavior: move mouse randomly
                try {
                    await page.mouse.move(
                        Math.random() * 800 + 200,
                        Math.random() * 400 + 200
                    );
                    await page.waitForTimeout(500 + Math.random() * 1000);
                } catch (e) {
                    console.log('Mouse movement failed, continuing...');
                }

                // Wait for challenge to complete - multiple strategies
                const solveStrategies = [
                    // Strategy 1: Wait for title change
                    () => page.waitForFunction(
                        () => !document.title.toLowerCase().includes('ddos') && 
                              !document.title.toLowerCase().includes('guard') &&
                              !document.title.toLowerCase().includes('checking'),
                        { timeout: 25000 }
                    ),
                    
                    // Strategy 2: Wait for body content change
                    () => page.waitForFunction(
                        () => {
                            const body = document.body.textContent.toLowerCase();
                            return !body.includes('ddos-guard') && 
                                   !body.includes('checking your browser') &&
                                   body.length > 1000;
                        },
                        { timeout: 25000 }
                    ),
                    
                    // Strategy 3: Wait for specific content
                    () => page.waitForSelector('main, .content, #content', { timeout: 20000 }),
                    
                    // Strategy 4: Simple timeout
                    () => page.waitForTimeout(15000)
                ];

                let solveSuccess = false;
                for (let i = 0; i < solveStrategies.length && !solveSuccess; i++) {
                    try {
                        console.log(`🧩 Trying solve strategy ${i + 1}/${solveStrategies.length}...`);
                        await solveStrategies[i]();
                        solveSuccess = true;
                        console.log(`✅ Challenge solve strategy ${i + 1} successful!`);
                    } catch (e) {
                        console.log(`❌ Strategy ${i + 1} failed, trying next...`);
                    }
                }

                // Additional wait for any redirects
                await page.waitForTimeout(2000);
            }

            // Get final content
            const finalContent = await page.content();
            const finalUrl = page.url();
            
            console.log('📄 Final page info:', {
                url: finalUrl,
                contentLength: finalContent.length,
                title: await page.title().catch(() => 'Unknown')
            });

            // Verify we got real content
            if (this.isDDoSGuardChallenge(finalContent, finalUrl)) {
                throw new Error('Challenge solving failed - still seeing DDoS-Guard page');
            }

            if (finalContent.length < 1000) {
                throw new Error('Content too short - possible incomplete load');
            }

            // Extract and store cookies for future requests
            const cookies = await context.cookies();
            if (cookies.length > 0) {
                const domain = new URL(url).hostname;
                const cookieHeader = cookies
                    .map(c => `${c.name}=${c.value}`)
                    .join('; ');
                this.sessionCookies.set(domain, cookieHeader);
                this.ddosGuardSessions.set(domain, {
                    cookies: cookieHeader,
                    timestamp: Date.now(),
                    userAgent: this.currentUA
                });
                console.log(`🍪 Extracted ${cookies.length} cookies for future use`);
            }

            console.log('✅ DDoS-Guard challenge successfully solved!');
            return finalContent;

        } catch (error) {
            console.error('❌ DDoS-Guard solver failed:', error.message);
            throw new CustomError(`Challenge solving failed: ${error.message}`, 503);
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

    // Main smart fetch method
    async smartFetch(url, options = {}) {
        const maxAttempts = 4;
        let lastError = null;
        
        console.log('🎯 SmartFetch starting for:', url);
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🚀 Attempt ${attempt}/${maxAttempts}`);
                
                // Smart delay between attempts
                if (attempt > 1) {
                    await this.smartDelay(attempt);
                }

                // Try enhanced axios first (faster)
                console.log('⚡ Trying enhanced axios request...');
                const axiosResult = await this.enhancedAxiosRequest(url, options);
                
                if (axiosResult.status === 200 && !this.isDDoSGuardChallenge(axiosResult.data, url)) {
                    console.log(`✅ Axios success on attempt ${attempt}`);
                    return axiosResult.data;
                }
                
                console.log(`🚫 Axios blocked/failed (status: ${axiosResult.status}), using browser solver...`);
                
                // Use browser solver for DDoS-Guard challenges
                const browserResult = await this.solveDDoSGuardChallenge(url, options);
                
                if (!this.isDDoSGuardChallenge(browserResult, url)) {
                    console.log(`✅ Browser solver success on attempt ${attempt}`);
                    return browserResult;
                }
                
                throw new Error('Browser solver still returned challenge page');
                
            } catch (error) {
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                lastError = error;
                
                // Don't retry on 404 or auth errors
                if (error.response?.status === 404 || error.response?.status === 401) {
                    throw error;
                }
                
                // For last attempt, throw the error
                if (attempt === maxAttempts) {
                    break;
                }
                
                // Progressive delay increase
                console.log(`⏳ Waiting before retry...`);
            }
        }
        
        throw new CustomError(
            `Failed to fetch after ${maxAttempts} attempts: ${lastError?.message}`,
            lastError?.response?.status || 503
        );
    }

    // Utility method for scraping with Cheerio
    async scrapeWithCheerio(url, options = {}) {
        const html = await this.smartFetch(url, options);
        return cheerio.load(html);
    }
}

// Export singleton instance
const requestManagerInstance = new RequestManager();
module.exports = requestManagerInstance;
