// scrapers/animepahe.js - Complete fixed version with enhanced play page scraping
const fs = require('fs').promises;
const path = require('path');
const Config = require('../utils/config');
const RequestManager = require("../utils/requestManager");
const { launchBrowser } = require('../utils/browser');
const { CustomError } = require('../middleware/errorHandler');
const axios = require('axios');
const os = require('os');

class Animepahe {
    constructor() {
        // Use /tmp directory for serverless environments
        this.cookiesPath = path.join(os.tmpdir(), 'cookies.json');
        this.cookiesRefreshInterval = 14 * 24 * 60 * 60 * 1000; // 14 days
        this.isRefreshingCookies = false;
    }

    async initialize() {
        const needsRefresh = await this.needsCookieRefresh();
        
        if (needsRefresh) {
            await this.refreshCookies();
        }
        
        return true;
    }

    async needsCookieRefresh() {
        try {
            const cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
            
            if (cookieData?.timestamp) {
                const ageInMs = Date.now() - cookieData.timestamp;
                return ageInMs > this.cookiesRefreshInterval;
            }
            return true;
        } catch (error) {
            return true;
        }
    }        
    
    async refreshCookies() {
        console.log('🍪 Refreshing cookies using enhanced browser...');
        let browser;

        try {
            browser = await launchBrowser();
            console.log('✅ Browser launched successfully');
        } catch (error) {
            if (error.message.includes("Executable doesn't exist")) {
                throw new CustomError('Browser setup required. Please run: npx playwright install', 500);
            }
            console.error('Browser launch error:', error);
            throw new CustomError(`Failed to launch browser: ${error.message}`, 500);
        }

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 }
        });
        
        const page = await context.newPage(); 

        try {
            console.log('🌐 Navigating to AnimePahe...');
            await page.goto(Config.getUrl('home'), {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });

            // Check for DDoS-Guard challenge
            const title = await page.title();
            if (title.includes('DDoS') || title.includes('Guard')) {
                console.log('🛡️ DDoS-Guard challenge detected during cookie refresh');
                await page.waitForTimeout(10000);
                
                try {
                    await page.waitForFunction(
                        () => !document.title.includes('DDoS') && !document.title.includes('Guard'),
                        { timeout: 20000 }
                    );
                    console.log('✅ DDoS-Guard challenge completed');
                } catch (e) {
                    console.log('⏰ Challenge timeout, continuing...');
                }
            }

            await page.waitForTimeout(3000);

            const cookies = await context.cookies();
            if (!cookies || cookies.length === 0) {
                throw new CustomError('No cookies found after page load', 503);
            }

            const cookieData = {
                timestamp: Date.now(),
                cookies,
            };

            await fs.mkdir(path.dirname(this.cookiesPath), { recursive: true });
            await fs.writeFile(this.cookiesPath, JSON.stringify(cookieData, null, 2));

            console.log(`✅ Cookies refreshed successfully (${cookies.length} cookies stored)`);
        } catch (error) {
            console.error('Cookie refresh error:', error);
            throw new CustomError(`Failed to refresh cookies: ${error.message}`, 503);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async getCookies(userProvidedCookies = null) {
        // If user provided cookies directly, use them
        if (userProvidedCookies) {
            if (typeof userProvidedCookies === 'string' && userProvidedCookies.trim()) {
                console.log('🍪 Using user-provided cookies');
                return userProvidedCookies.trim();
            } else {
                throw new CustomError('Invalid user-provided cookies format', 400);
            }
        }
        
        console.log('🔍 Checking Config for cookies...');
        if (Config.cookies && Config.cookies.trim()) {
            console.log('✅ Using cookies from Config');
            return Config.cookies.trim();
        }

        // Try to read cookies from file
        let cookieData;
        try {
            cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
        } catch (error) {
            console.log('🔄 No stored cookies found, refreshing...');
            await this.refreshCookies();
            cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
        }

        // Check if cookies are stale
        const ageInMs = Date.now() - cookieData.timestamp;
        if (ageInMs > this.cookiesRefreshInterval && !this.isRefreshingCookies) {
            console.log('🔄 Cookies are stale, refreshing in background...');
            this.isRefreshingCookies = true;
            this.refreshCookies()
                .catch(err => console.error('Background cookie refresh failed:', err))
                .finally(() => { this.isRefreshingCookies = false; });
        }

        // Return current cookies (even if stale)
        const cookieHeader = cookieData.cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
        Config.setCookies(cookieHeader);
        return Config.cookies;
    }

    // FIXED: Proper API data fetching with error handling
    async fetchApiData(endpoint, params = {}, userProvidedCookies = null) {
        try {
            const cookieHeader = await this.getCookies(userProvidedCookies);
            const url = new URL(endpoint, Config.getUrl('home')).toString();
            console.log('🔗 API request to:', url, 'with params:', params);
            
            // Use RequestManager with isApiRequest flag
            const response = await RequestManager.fetchApiData(url, params, cookieHeader);
            
            console.log('📊 Raw API response type:', typeof response);
            console.log('📊 Raw API response sample:', 
                typeof response === 'string' ? response.substring(0, 200) + '...' : 
                JSON.stringify(response).substring(0, 200) + '...');
            
            // Handle different response types
            if (typeof response === 'string') {
                try {
                    const parsed = JSON.parse(response);
                    console.log('✅ Successfully parsed JSON response');
                    return parsed;
                } catch (e) {
                    console.error('❌ Failed to parse JSON:', e.message);
                    console.log('Raw response:', response.substring(0, 500));
                    throw new CustomError('Invalid JSON response from API', 502);
                }
            } else if (typeof response === 'object' && response !== null) {
                console.log('✅ Response is already an object');
                return response;
            } else {
                console.error('❌ Unexpected response type:', typeof response);
                throw new CustomError('Unexpected response format from API', 502);
            }
            
        } catch (error) {
            console.error('❌ API request failed:', error.message);
            
            // Only retry with fresh cookies if user didn't provide cookies and it's an auth error
            if (!userProvidedCookies && (
                error.response?.status === 401 || 
                error.response?.status === 403 ||
                error.message.includes('Authentication required')
            )) {
                console.log('🔄 Auth error detected, refreshing cookies and retrying...');
                await this.refreshCookies();
                const retryUrl = new URL(endpoint, Config.getUrl('home')).toString();
                const newCookieHeader = await this.getCookies();
                return await RequestManager.fetchApiData(retryUrl, params, newCookieHeader);
            }
            
            // Check if it's a "no results" case vs actual error
            if (error.response?.status === 404 || error.message.includes('No') || error.message.includes('not found')) {
                console.log('📭 No results found, returning empty data structure');
                // Return appropriate empty structure based on endpoint
                if (params.m === 'search') {
                    return { data: [], total: 0, per_page: 8, current_page: params.page || 1 };
                } else if (params.m === 'airing') {
                    return { data: [], total: 0, per_page: 8, current_page: params.page || 1 };
                } else {
                    return { data: [] };
                }
            }
            
            throw new CustomError(error.message || 'Failed to fetch API data', error.response?.status || 503);
        }
    }

    // API Methods with better error handling
    async fetchAiringData(page = 1, userProvidedCookies = null) {
        try {
            return await this.fetchApiData('/api', { m: 'airing', page }, userProvidedCookies);
        } catch (error) {
            if (error.message.includes('No') || error.response?.status === 404) {
                return { data: [], total: 0, per_page: 8, current_page: page };
            }
            throw error;
        }
    }

    async fetchSearchData(query, page = 1, userProvidedCookies = null) {
        if (!query || query.trim() === '') {
            throw new CustomError('Search query is required', 400);
        }
        
        try {
            return await this.fetchApiData('/api', { m: 'search', q: query.trim(), page }, userProvidedCookies);
        } catch (error) {
            if (error.message.includes('No') || error.response?.status === 404) {
                return { data: [], total: 0, per_page: 8, current_page: page };
            }
            throw error;
        }
    }

    async fetchQueueData(userProvidedCookies = null) {
        try {
            return await this.fetchApiData('/api', { m: 'queue' }, userProvidedCookies);
        } catch (error) {
            if (error.message.includes('No') || error.response?.status === 404) {
                return { data: [] };
            }
            throw error;
        }
    }

    async fetchAnimeRelease(id, sort, page = 1, userProvidedCookies = null) {
        if (!id) {
            throw new CustomError('Anime ID is required', 400);
        }
        
        try {
            return await this.fetchApiData('/api', { m: 'release', id, sort, page }, userProvidedCookies);
        } catch (error) {
            if (error.message.includes('No') || error.response?.status === 404) {
                return { data: [], total: 0, per_page: 8, current_page: page };
            }
            throw error;
        }
    }

    // Scraping Methods using RequestManager (for HTML content)
    async scrapeAnimeInfo(animeId) {
        if (!animeId) {
            throw new CustomError('Anime ID is required', 400);
        }

        const url = `${Config.getUrl('animeInfo')}${animeId}`;
        const cookieHeader = await this.getCookies();
        
        console.log('🎬 Scraping anime info:', url);
        // Use smartFetch with isApiRequest: false for HTML content
        const html = await RequestManager.smartFetch(url, { 
            cookieHeader, 
            isApiRequest: false 
        });

        if (!html || html.length < 1000) {
            throw new CustomError('Failed to fetch anime info or content too short', 503);
        }

        return html;
    }

    async scrapeAnimeList(tag1, tag2) {
        const url = tag1 || tag2 
            ? `${Config.getUrl('animeList', tag1, tag2)}`
            : `${Config.getUrl('animeList')}`;

        const cookieHeader = await this.getCookies();
        
        console.log('📋 Scraping anime list:', url);
        const html = await RequestManager.smartFetch(url, { 
            cookieHeader, 
            isApiRequest: false 
        });

        if (!html || html.length < 1000) {
            throw new CustomError('Failed to fetch anime list or content too short', 503);
        }

        return html;
    }

    // ENHANCED: Multi-strategy play page scraping
    async scrapePlayPage(id, episodeId) {
        if (!id || !episodeId) {
            throw new CustomError('Both ID and episode ID are required', 400);
        }

        const url = Config.getUrl('play', id, episodeId);
        console.log('▶️ Enhanced scraping play page:', url);
        
        // Try multiple strategies for play page scraping
        const strategies = [
            () => this.scrapePlayPageWithBrowser(url),
            () => this.scrapePlayPageWithAxios(url),
            () => this.scrapePlayPageWithAlternativeMethod(url)
        ];

        let lastError = null;
        
        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`🎯 Trying play page strategy ${i + 1}/${strategies.length}...`);
                const result = await strategies[i]();
                
                if (result && result.length > 500) {
                    console.log(`✅ Play page strategy ${i + 1} successful!`);
                    return result;
                } else {
                    throw new Error('Content too short or empty');
                }
            } catch (error) {
                console.log(`❌ Strategy ${i + 1} failed:`, error.message);
                lastError = error;
                
                // Add delay between strategies
                if (i < strategies.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        throw new CustomError(
            `Failed to scrape play page after ${strategies.length} attempts: ${lastError?.message}`,
            lastError?.response?.status || 503
        );
    }

    // Strategy 1: Enhanced browser scraping with maximum stealth
    async scrapePlayPageWithBrowser(url) {
        console.log('🕷️ Strategy 1: Enhanced browser scraping');
        
        let browser = null;
        let context = null;
        let page = null;

        try {
            browser = await launchBrowser();
            
            // Ultra-stealth configuration
            const contextOptions = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { 
                    width: 1920 + Math.floor(Math.random() * 100), 
                    height: 1080 + Math.floor(Math.random() * 100) 
                },
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://animepahe.ru/',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                locale: 'en-US',
                timezoneId: 'America/New_York',
                permissions: ['geolocation'],
                geolocation: { latitude: 40.7128, longitude: -74.0060 },
                colorScheme: 'light'
            };

            context = await browser.newContext(contextOptions);
            context.setDefaultTimeout(60000);
            
            page = await context.newPage();

            // Advanced stealth setup
            await page.addInitScript(() => {
                // Remove webdriver traces
                delete navigator.__proto__.webdriver;
                
                // Override plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', length: 1, filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', length: 1, filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', length: 1, filename: 'internal-nacl-plugin' }
                    ],
                });
                
                // Override languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Override webgl
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel(R) UHD Graphics 620';
                    return getParameter.apply(this, arguments);
                };
                
                // Mock chrome runtime
                window.chrome = {
                    runtime: {
                        onConnect: null,
                        onMessage: null
                    }
                };
                
                // Override permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // Add realistic screen properties
                Object.defineProperty(screen, 'availWidth', { value: 1920 });
                Object.defineProperty(screen, 'availHeight', { value: 1040 });
                Object.defineProperty(screen, 'colorDepth', { value: 24 });
                Object.defineProperty(screen, 'pixelDepth', { value: 24 });
            });

            // Get cookies from our session
            const cookieHeader = await this.getCookies();
            if (cookieHeader) {
                const cookies = cookieHeader.split('; ').map(cookie => {
                    const [name, value] = cookie.split('=');
                    return {
                        name: name.trim(),
                        value: value.trim(),
                        domain: '.animepahe.ru',
                        path: '/'
                    };
                });
                await context.addCookies(cookies);
                console.log(`🍪 Added ${cookies.length} cookies to browser context`);
            }

            console.log('🚀 Navigating to play page...');
            
            // Navigate with multiple fallbacks
            try {
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 45000 
                });
            } catch (navError) {
                console.log('First navigation failed, trying with networkidle...');
                await page.goto(url, { 
                    waitUntil: 'networkidle',
                    timeout: 60000 
                });
            }

            // Check for challenges and handle them
            await this.handlePlayPageChallenges(page);

            // Wait for page to fully load
            await page.waitForTimeout(3000);

            // Try to wait for key elements
            try {
                await page.waitForSelector('body', { timeout: 10000 });
                console.log('✅ Page body loaded');
            } catch (e) {
                console.log('⚠️ Body selector timeout, continuing...');
            }

            // Get final content
            const content = await page.content();
            console.log(`📄 Play page content length: ${content.length}`);

            // Validate content
            if (content.length < 500) {
                throw new Error('Play page content too short');
            }

            if (content.includes('DDoS-Guard') || content.includes('checking your browser')) {
                throw new Error('Still seeing DDoS-Guard challenge');
            }

            return content;

        } catch (error) {
            console.error('❌ Browser strategy failed:', error.message);
            throw error;
        } finally {
            try {
                if (page) await page.close();
                if (context) await context.close();
                if (browser) await browser.close();
            } catch (cleanupError) {
                console.error('Browser cleanup error:', cleanupError.message);
            }
        }
    }

    // Strategy 2: Advanced axios with residential-like headers
    async scrapePlayPageWithAxios(url) {
        console.log('🌐 Strategy 2: Advanced axios scraping');
        
        const cookieHeader = await this.getCookies();
        
        // Residential-like headers
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://animepahe.ru/',
            'Origin': 'https://animepahe.ru',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Cookie': cookieHeader,
            // Additional residential indicators
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'X-Forwarded-For': this.generateRandomIP(),
            'X-Real-IP': this.generateRandomIP()
        };

        const axiosConfig = {
            method: 'GET',
            url: url,
            headers: headers,
            timeout: 30000,
            maxRedirects: 10,
            validateStatus: (status) => status < 500
        };

        try {
            const response = await axios(axiosConfig);
            
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = response.data;
            
            if (typeof content !== 'string' || content.length < 500) {
                throw new Error('Invalid or too short response');
            }

            if (content.includes('DDoS-Guard') || content.includes('checking your browser')) {
                throw new Error('DDoS-Guard challenge detected');
            }

            return content;

        } catch (error) {
            console.error('❌ Axios strategy failed:', error.message);
            throw error;
        }
    }

    // Strategy 3: Alternative method with different approach
    async scrapePlayPageWithAlternativeMethod(url) {
        console.log('🔄 Strategy 3: Alternative method');
        
        // Wait 5 seconds then try browser approach again with different settings
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        return await this.scrapePlayPageWithBrowser(url);
    }

    // Helper method to handle challenges on play pages
    async handlePlayPageChallenges(page) {
        try {
            const title = await page.title();
            const bodyText = await page.textContent('body').catch(() => '');
            
            const hasDDoSGuard = title.toLowerCase().includes('ddos') ||
                                title.toLowerCase().includes('guard') ||
                                bodyText.toLowerCase().includes('ddos-guard') ||
                                bodyText.toLowerCase().includes('checking your browser');
            
            if (hasDDoSGuard) {
                console.log('🛡️ DDoS-Guard challenge detected on play page');
                
                // Human-like interaction
                await page.mouse.move(
                    Math.random() * 1000 + 100,
                    Math.random() * 600 + 100
                );
                
                await page.waitForTimeout(2000 + Math.random() * 3000);
                
                // Wait for challenge to complete
                try {
                    await page.waitForFunction(
                        () => !document.title.toLowerCase().includes('ddos') && 
                              !document.title.toLowerCase().includes('guard'),
                        { timeout: 30000 }
                    );
                    console.log('✅ Play page challenge completed');
                } catch (e) {
                    console.log('⏰ Challenge timeout on play page');
                }
                
                // Additional wait
                await page.waitForTimeout(3000);
            }
        } catch (error) {
            console.log('⚠️ Error handling play page challenges:', error.message);
        }
    }

    // Helper to generate random IP (for headers)
    generateRandomIP() {
        return `${Math.floor(Math.random() * 255) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    async scrapeIframe(url) {
        if (!url) {
            throw new CustomError('URL is required', 400);
        }

        const cookieHeader = await this.getCookies();
        
        console.log('🖼️ Scraping iframe:', url);
        const html = await RequestManager.smartFetch(url, { 
            cookieHeader, 
            isApiRequest: false 
        });

        if (!html || html.length < 100) {
            throw new CustomError('Failed to fetch iframe or content too short', 503);
        }

        return html;
    }    

    // FIXED: Main getData method with better error handling and fallback logic
    async getData(type, params, preferFetch = true) {
        try {
            if (preferFetch) {
                console.log(`📡 Fetching ${type} data via API...`);
                switch (type) {
                    case 'airing':
                        return await this.fetchAiringData(params.page || 1, params.userProvidedCookies);
                    case 'search':
                        return await this.fetchSearchData(params.query, params.page || 1, params.userProvidedCookies);
                    case 'queue':
                        return await this.fetchQueueData(params.userProvidedCookies);
                    case 'releases':
                        return await this.fetchAnimeRelease(params.animeId, params.sort, params.page || 1, params.userProvidedCookies);
                    default:
                        throw new CustomError(`API method not available for type: ${type}`, 400);
                }
            } else {
                console.log(`🕸️ Scraping ${type} data via HTML...`);
                switch (type) {
                    case 'animeList':
                        return await this.scrapeAnimeList(params.tag1, params.tag2);
                    case 'animeInfo':
                        return await this.scrapeAnimeInfo(params.animeId);
                    case 'play':
                        return await this.scrapePlayPage(params.id, params.episodeId);
                    case 'iframe':
                        return await this.scrapeIframe(params.url);
                    default:
                        throw new CustomError(`Scraping method not available for type: ${type}`, 400);
                }
            }
        } catch (error) {
            console.error(`❌ ${type} data fetch failed:`, error.message);
            
            if (error instanceof CustomError) {
                // Don't retry on client errors (4xx)
                if (error.statusCode >= 400 && error.statusCode < 500) {
                    throw error;
                }
            }

            // Try fallback only for certain types and only if we haven't tried scraping yet
            if (preferFetch && ['airing', 'search'].includes(type)) {
                console.log(`🔄 API failed for ${type}, trying scraping fallback is not available for this type`);
                // For these types, we don't have scraping alternatives, so return empty results
                return {
                    data: [],
                    total: 0,
                    per_page: 8,
                    current_page: params.page || 1
                };
            }
            
            // Re-throw the original error if no fallback is possible
            throw new CustomError(
                error.message || `Failed to get ${type} data`, 
                error.response?.status || error.statusCode || 503
            );
        }
    }
}

module.exports = new Animepahe();
