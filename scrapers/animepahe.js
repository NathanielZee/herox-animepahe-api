// scrapers/animepahe.js - Fixed version with proper API handling
const fs = require('fs').promises;
const path = require('path');
const Config = require('../utils/config');
const RequestManager = require("../utils/requestManager");
const { launchBrowser } = require('../utils/browser');
const { CustomError } = require('../middleware/errorHandler');
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

    async scrapePlayPage(id, episodeId) {
        if (!id || !episodeId) {
            throw new CustomError('Both ID and episode ID are required', 400);
        }

        const url = Config.getUrl('play', id, episodeId);
        const cookieHeader = await this.getCookies();
        
        console.log('▶️ Scraping play page:', url);
        
        try {
            const html = await RequestManager.smartFetch(url, { 
                cookieHeader, 
                isApiRequest: false 
            });
            
            if (!html || html.length < 500) {
                throw new CustomError('Failed to fetch play page or content too short', 503);
            }
            
            return html;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new CustomError('Anime or episode not found', 404);
            }
            console.error('Play page scraping error:', error.message);
            throw new CustomError(`Failed to scrape play page: ${error.message}`, error.response?.status || 503);
        }
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
