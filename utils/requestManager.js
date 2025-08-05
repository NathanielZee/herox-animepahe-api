// utils/requestManager.js - Fixed version with proper API/HTML detection
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
        return await instance.smartFetch(fullUrl.toString(), { 
            cookieHeader, 
            isApiRequest: true 
        });
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
        return await this.smartFetch(fullUrl.toString(), { 
            cookieHeader, 
            isApiRequest: true 
        });
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

    // FIXED: Proper DDoS-Guard detection that distinguishes between API and HTML responses
    isDDoSGuardChallenge(response, url, isApiRequest = false) {
        if (!response) return true;
        
        const domain = new URL(url).hostname;
        
        // For API requests, check if we got JSON data
        if (isApiRequest) {
            // If it's a string that looks like JSON, it's probably good
            if (typeof response === 'string') {
                try {
                    const parsed = JSON.parse(response);
                    // Valid JSON with expected structure means no challenge
                    if (parsed && (parsed.data || parsed.total !== undefined || Array.isArray(parsed))) {
                        console.log('✅ Valid API JSON response detected');
                        return false;
                    }
                } catch (e) {
                    // Not JSON, check if it's HTML challenge
                }
            } else if (typeof response === 'object') {
                // Already parsed JSON object - definitely not a challenge
                console.log('✅ Valid API object response detected');
                return false;
            }
        }

        // For HTML responses or failed JSON parsing, check challenge indicators
        const responseText = typeof response === 'string' ? response : JSON.stringify(response);
        const lowerResponse = responseText.toLowerCase();
        
        // Comprehensive DDoS-Guard indicators
        const ddosIndicators = [
            'ddos-guard',
            'checking your browser',
            'please wait while we verify',
            'verifying you are human',
            'browser verification',
            'security check',
            'anti-bot verification',
            'challenge-platform',
            'just a moment',
            'enable javascript and cookies',
            'this process is automatic',
            'please allow up to 5 seconds'
        ];

        const hasIndicators = ddosIndicators.some(indicator => 
            lowerResponse.includes(indicator)
        );

        // Check for challenge page patterns
        const challengePatterns = [
            /<title[^>]*>(?:just a moment|checking|verifying|ddos|guard|security)/i,
            /ddosguard/i,
            /challenge-form/i,
            /check.*browser/i
        ];

        const hasPatterns = challengePatterns.some(pattern => pattern.test(responseText));

        // Check response length (challenge pages are usually short)
        const isShortResponse = responseText.length < 1000;
        
        // Check for actual content indicators
        const hasRealContent = responseText.includes('<main>') || 
                              responseText.includes('class="content"') ||
                              responseText.includes('animepahe') ||
                              responseText.length > 5000;

        const isBlocked = (hasIndicators || hasPatterns) && (!hasRealContent || isShortResponse);
        
        if (isBlocked) {
            console.log(`🚫 DDoS-Guard challenge detected for ${domain}:`, {
                hasIndicators,
                hasPatterns,
                isShortResponse,
                responseLength: responseText.length,
                hasRealContent,
                isApiRequest
            });
        }

        return isBlocked;
    }

    // Enhanced headers with fingerprint randomization
    generateStealthHeaders(url, cookies = '', isApiRequest = false) {
        const domain = new URL(url).hostname;
        
        // Rotate UA every 20 requests
        if (this.requestCount % 20 === 0) {
            this.rotateSession();
        }
        
        const headers = {
            'User-Agent': this.currentUA,
            'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
            'Pragma': 'no-cache'
        };

        // Different headers for API vs HTML requests
        if (isApiRequest) {
            headers['Accept'] = 'application/json, text/plain, */*';
            headers['X-Requested-With'] = 'XMLHttpRequest';
        } else {
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
            headers['Upgrade-Insecure-Requests'] = '1';
            headers['Sec-Fetch-Dest'] = 'document';
            headers['Sec-Fetch-Mode'] = 'navigate';
            headers['Sec-Fetch-Site'] = 'none';
            headers['Sec-Fetch-User'] = '?1';
        }

        // Add Chrome-specific headers
        if (this.currentUA.includes('Chrome')) {
            headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = '"Windows"';
        }

        // Add appropriate referer
        if (domain.includes('animepahe')) {
            headers['Referer'] = 'https://animepahe.ru/';
            if (isApiRequest) {
                headers['Origin'] = 'https://animepahe.ru';
            }
        }

        // Add cookies
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
        const baseDelay = Math.max(300 + Math.random() * 200, 500 - timeSinceLastRequest);
        
        // Exponential backoff for retries
        const retryMultiplier = Math.pow(1.5, attempt - 1);
        const delay = Math.min(baseDelay * retryMultiplier, 5000);
        
        if (delay > 0) {
            console.log(`⏱️ Smart delay: ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
    }

    // FIXED: Enhanced axios request with proper API handling
    async enhancedAxiosRequest(url, options = {}) {
        const domain = new URL(url).hostname;
        const cookies = options.cookieHeader || '';
        const isApiRequest = options.isApiRequest || false;
        
        const headers = this.generateStealthHeaders(url, cookies, isApiRequest);
        
        const axiosConfig = {
            method: 'GET',
            url: url,
            headers: {
                ...headers,
                ...options.headers
            },
            timeout: 20000,
            maxRedirects: 5,
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

    // Browser solver for HTML pages only
    async solveDDoSGuardChallenge(url, options = {}) {
        console.log('🛡️ Starting DDoS-Guard challenge solver for:', url);
        
        let browser = null;
        let context = null;
        let page = null;

        try {
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
                locale: 'en-US',
                timezoneId: 'America/New_York'
            };

            context = await browser.newContext(contextOptions);
            context.setDefaultTimeout(45000);
            
            page = await context.newPage();

            // Ultra-stealth browser setup
            await page.addInitScript(() => {
                delete navigator.__proto__.webdriver;
                
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', length: 1 },
                        { name: 'Chrome PDF Viewer', length: 1 },
                        { name: 'Native Client', length: 1 }
                    ],
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel(R) HD Graphics';
                    return getParameter.apply(this, arguments);
                };
                
                window.chrome = { runtime: {} };
            });

            console.log('🚀 Navigating to target URL...');
            
            await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Check for challenge
            let challengeDetected = false;
            try {
                const title = await page.title();
                const bodyText = await page.textContent('body').catch(() => '');
                
                challengeDetected = title.toLowerCase().includes('ddos') ||
                                  title.toLowerCase().includes('guard') ||
                                  title.toLowerCase().includes('checking') ||
                                  bodyText.toLowerCase().includes('ddos-guard') ||
                                  bodyText.toLowerCase().includes('checking your browser');
                
            } catch (e) {
                console.log('⚠️ Could not check for challenge immediately');
            }

            if (challengeDetected) {
                console.log('🛡️ DDoS-Guard challenge confirmed - waiting for completion...');
                
                // Human-like behavior
                try {
                    await page.mouse.move(
                        Math.random() * 800 + 200,
                        Math.random() * 400 + 200
                    );
                    await page.waitForTimeout(500 + Math.random() * 1000);
                } catch (e) {
                    console.log('Mouse movement failed, continuing...');
                }

                // Wait for challenge completion
                try {
                    await page.waitForFunction(
                        () => !document.title.toLowerCase().includes('ddos') && 
                              !document.title.toLowerCase().includes('guard') &&
                              !document.title.toLowerCase().includes('checking'),
                        { timeout: 25000 }
                    );
                    console.log('✅ Challenge completed!');
                } catch (e) {
                    console.log('⏰ Challenge timeout, continuing...');
                }

                await page.waitForTimeout(2000);
            }

            const finalContent = await page.content();
            const finalUrl = page.url();
            
            console.log('📄 Final page info:', {
                url: finalUrl,
                contentLength: finalContent.length,
                title: await page.title().catch(() => 'Unknown')
            });

            // Verify we got real content
            if (this.isDDoSGuardChallenge(finalContent, finalUrl, false)) {
                throw new Error('Challenge solving failed - still seeing DDoS-Guard page');
            }

            // Extract cookies
            const cookies = await context.cookies();
            if (cookies.length > 0) {
                const domain = new URL(url).hostname;
                const cookieHeader = cookies
                    .map(c => `${c.name}=${c.value}`)
                    .join('; ');
                this.sessionCookies.set(domain, cookieHeader);
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

    // FIXED: Main smart fetch method with proper API/HTML handling
    async smartFetch(url, options = {}) {
        const maxAttempts = 3;
        let lastError = null;
        const isApiRequest = options.isApiRequest || false;
        
        console.log(`🎯 SmartFetch starting for: ${url} (API: ${isApiRequest})`);
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🚀 Attempt ${attempt}/${maxAttempts}`);
                
                if (attempt > 1) {
                    await this.smartDelay(attempt);
                }

                // Try axios first
                console.log('⚡ Trying enhanced axios request...');
                const axiosResult = await this.enhancedAxiosRequest(url, options);
                
                // FIXED: Check response properly based on request type
                if (axiosResult.status >= 200 && axiosResult.status < 300) {
                    if (!this.isDDoSGuardChallenge(axiosResult.data, url, isApiRequest)) {
                        console.log(`✅ Axios success on attempt ${attempt}`);
                        return axiosResult.data;
                    } else {
                        console.log(`🚫 DDoS-Guard challenge detected, using browser solver...`);
                    }
                } else {
                    console.log(`🚫 Axios failed with status: ${axiosResult.status}`);
                }
                
                // Only use browser solver for HTML pages, not API endpoints
                if (!isApiRequest) {
                    const browserResult = await this.solveDDoSGuardChallenge(url, options);
                    
                    if (!this.isDDoSGuardChallenge(browserResult, url, false)) {
                        console.log(`✅ Browser solver success on attempt ${attempt}`);
                        return browserResult;
                    }
                } else {
                    // For API requests, if axios failed, it's likely a real error
                    throw new CustomError(`API request failed with status: ${axiosResult.status}`, axiosResult.status);
                }
                
            } catch (error) {
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                lastError = error;
                
                // Don't retry on certain errors
                if (error.response?.status === 404 || 
                    error.response?.status === 401 || 
                    error.response?.status === 400) {
                    throw error;
                }
                
                if (attempt === maxAttempts) {
                    break;
                }
            }
        }
        
        throw new CustomError(
            `Failed to fetch after ${maxAttempts} attempts: ${lastError?.message}`,
            lastError?.response?.status || 503
        );
    }

    // Utility method for scraping with Cheerio
    async scrapeWithCheerio(url, options = {}) {
        const html = await this.smartFetch(url, { ...options, isApiRequest: false });
        return cheerio.load(html);
    }

    // Simple delay utility
    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Simple retry utility
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
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this.delay(delay);
            }
        }
        
        throw lastError;
    }
}

// Export singleton instance
const requestManagerInstance = new RequestManager();
module.exports = requestManagerInstance;
