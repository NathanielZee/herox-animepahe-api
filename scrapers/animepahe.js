const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const Config = require('../utils/config');
const RequestManager = require("../utils/requestManager");
const { CustomError } = require('../middleware/errorHandler');

class Animepahe {
    constructor() {
        this.cookiesPath = path.join(__dirname, '../data/cookies.json');
        this.cookiesRefreshInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
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
       console.log('Refreshing cookies...');

        let browser;
        try {
            browser = await chromium.launch({ headless: true });
        } catch (error) {
            if (error.message.includes("Executable doesn't exist")) {
                throw new CustomError('Browser setup required. Please run: npx playwright install', 500);
            }
            throw new CustomError('Failed to launch browser', 500);
        }

        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            await page.goto(Config.getUrl('home'), { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            await page.waitForTimeout(5000);
            
            const cookies = await context.cookies();
            const cookieData = {
                timestamp: Date.now(),
                cookies: cookies
            };
            
            await fs.mkdir(path.dirname(this.cookiesPath), { recursive: true });
            await fs.writeFile(this.cookiesPath, JSON.stringify(cookieData, null, 2));

            console.log('Cookies refreshed successfully');
        } catch (error) {
            throw new CustomError('Failed to refresh cookies', 503);
        } finally {
            await browser?.close();
        }
    }

    async getCookies(userProvidedCookies = null) {
        // If user provided cookies directly, use them
        if (userProvidedCookies) {
            if (typeof userProvidedCookies === 'string' && userProvidedCookies.trim()) {
                console.log('Using user-provided cookies');
                return userProvidedCookies.trim();
            } else {
                throw new CustomError('Invalid user-provided cookies format', 400);
            }
        }
        console.log('No user-provided cookies or is in an invalid format, checking Config...');
        if (Config.cookies && Config.cookies.trim()) {
            console.log('Using cookies from Config');
            return Config.cookies.trim();
        }

        await this.initialize();

        try {
            const cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
            const cookieHeader = cookieData.cookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join('; ');

            Config.setCookies(cookieHeader);
            return Config.cookies;
        } catch (error) {
            throw new CustomError('Failed to get cookies', 503);
        }
    }

    async fetchApiData(endpoint, params = {}, userProvidedCookies = null) {
        try {
            const cookieHeader = await this.getCookies(userProvidedCookies);
            const url = new URL(endpoint, Config.getUrl('home')).toString();
            return await RequestManager.fetchApiData(url, params, cookieHeader);
        } catch (error) {
            // Only retry with automatic cookies if user didn't provide cookies
            if (!userProvidedCookies && (error.response?.status === 401 || error.response?.status === 403)) {
                await this.refreshCookies();
                return this.fetchApiData(endpoint, params, userProvidedCookies);
            }
            throw new CustomError(error.message || 'Failed to fetch API data', error.response?.status || 503);
        }
    }
    
    async scrapeApiData(endpoint, pageUrl, waitTime = 10000) {
        let browser;
        try {
            browser = await chromium.launch({ headless: true });
        } catch (error) {
            if (error.message.includes("Executable doesn't exist")) {
                throw new CustomError('Browser setup required. Please run: npx playwright install', 500);
            }
            throw new CustomError('Failed to launch browser', 500);
        }

        const context = await browser.newContext();
        const page = await context.newPage();
        let apiData = null;
        
        try {
            page.on('response', async (response) => {
                try {
                    const url = response.url();
                    if (url.includes(endpoint) && 
                        response.status() === 200 && 
                        response.headers()['content-type']?.includes('application/json')) {
                        apiData = await response.json();
                    }
                } catch (error) {
                    
                }
            });

            await page.goto(pageUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: 60000 
            });
            
            await page.waitForTimeout(waitTime);
            await page.waitForSelector('body', { timeout: 5000 });

            if (!apiData) {
                throw new CustomError('No API data found', 404);
            }

            return apiData;
        } catch (error) {
            if (error instanceof CustomError) throw error;
            throw new CustomError(error.message || 'Failed to scrape API data', 503);
        } finally {
            await browser?.close();
        }
    }

    // API Methods
    async fetchAiringData(page = 1, userProvidedCookies = null) {
        return this.fetchApiData('/api', { m: 'airing', page }, userProvidedCookies = null);
    }

    async fetchSearchData(query, page, userProvidedCookies = null) {
        if (!query) {
            throw new CustomError('Search query is required', 400);
        }
        return this.fetchApiData('/api', { m: 'search', q: query, page }, userProvidedCookies = null);
    }

    async fetchQueueData() {
        return this.fetchApiData('/api', { m: 'queue' }, userProvidedCookies = null);
    }

    async fetchAnimeRelease(id, sort, page, userProvidedCookies = null) {
        if (!id) {
            throw new CustomError('Anime ID is required', 400);
        }
        return this.fetchApiData('/api', { m: 'release', id, sort, page }, userProvidedCookies = null);
    }

    // Scraping Methods

    async scrapeAnimeInfo(animeId) {
        if (!animeId) {
            throw new CustomError('Anime ID is required', 400);
        }

        const url = `${Config.getUrl('animeInfo')}${animeId}`;
        const cookieHeader = await this.getCookies();
        const html = await RequestManager.fetch(url, cookieHeader);

        if (!html) {
            throw new CustomError('Failed to fetch anime info', 503);
        }

        return html;
    }

    async scrapeAnimeList(tag1, tag2) {
        const url = tag1 || tag2 
            ? `${Config.getUrl('animeList', tag1, tag2)}`
            : `${Config.getUrl('animeList')}`;

        const cookieHeader = await this.getCookies();
        const html = await RequestManager.fetch(url, cookieHeader);

        if (!html) {
            throw new CustomError('Failed to fetch anime list', 503);
        }

        return html;
    }    async scrapePlayPage(id, episodeId) {
        if (!id || !episodeId) {
            throw new CustomError('Both ID and episode ID are required', 400);
        }

        const url = Config.getUrl('play', id, episodeId);
        const cookieHeader = await this.getCookies();
        
        try {
            const html = await RequestManager.fetch(url, cookieHeader);
            if (!html) {
                throw new CustomError('Failed to fetch play page', 503);
            }
            return html;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new CustomError('Anime or episode not found', 404);
            }
            throw error;
        }
    }

    async scrapeIframe(url) {
        if (!url) {
            throw new CustomError('URL is required', 400);
        }

        const cookieHeader = await this.getCookies();
        const html = await RequestManager.fetch(url, cookieHeader);

        if (!html) {
            throw new CustomError('Failed to fetch iframe', 503);
        }

        return html;
    }

    async getData(type, params, preferFetch = true) {
        try {
            if (preferFetch) {
                switch (type) {
                    case 'airing':
                        return await this.fetchAiringData(params.page || 1);
                    case 'search':
                        return await this.fetchSearchData(params.query, params.page);
                    case 'queue':
                        return await this.fetchQueueData();
                    case 'releases':
                        return await this.fetchAnimeRelease(params.animeId, params.sort, params.page);
                }
            } else {
                switch (type) {
                    case 'search':
                        return await this.scrapeSearchData(params.query);
                    case 'animeList':
                        return await this.scrapeAnimeList(params.tag1, params.tag2);
                    case 'animeInfo':
                        return await this.scrapeAnimeInfo(params.animeId);
                    case 'play':
                        return await this.scrapePlayPage(params.id, params.episodeId);
                    case 'iframe':
                        return await this.scrapeIframe(params.url);
                }
            }

            throw new CustomError(`Unsupported data type: ${type}`, 400);
        } catch (error) {
            if (error instanceof CustomError) throw error;

            // Try fallback if primary method fails
            if (preferFetch) {
                return this.getData(type, params, false);
            }
            
            throw new CustomError(error.message || 'Failed to get data', 503);
        }
    }
}

module.exports = new Animepahe();