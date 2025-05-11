const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const Config = require('../utils/config');
const RequestManager = require("../utils/requestManager");
const BaseScraper = require('../scrapers/baseScraper');

class ApiClient {
    constructor() {
        this.cookiesPath = path.join(__dirname, '../data/cookies.json');
        this.cookiesRefreshInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    }

    async initialize() {
        try {
            // Check if we have valid cookies
            const needsRefresh = await this.needsCookieRefresh();
            
            if (needsRefresh) {
                console.log('Cookies expired or not found. Refreshing...');
                await this.refreshCookies();
            } else {
                console.log('Using existing cookies');
            }
            
            return true;
        } catch (error) {
            console.error('Error initializing API client:', error);
            return false;
        }
    }

    async needsCookieRefresh() {
        try {
            const cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
            
            // Check if cookies exist and aren't too old
            if (cookieData && cookieData.timestamp) {
                const ageInMs = Date.now() - cookieData.timestamp;
                return ageInMs > this.cookiesRefreshInterval;
            }
            return true; // No timestamp or no cookie file
        } catch (error) {
            return true; // Error reading file, so refresh needed
        }
    }

    async refreshCookies() {
        console.log('Getting fresh cookies from website...');
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // Navigate to the site
            await page.goto(Config.getUrl('home'), { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            // Wait for any DDOS protection or cookie setup to complete
            await page.waitForTimeout(5000);
            
            // Get all cookies
            const cookies = await context.cookies();
            
            // Save cookies with timestamp
            const cookieData = {
                timestamp: Date.now(),
                cookies: cookies
            };
            
            await fs.mkdir(path.dirname(this.cookiesPath), { recursive: true });
            await fs.writeFile(this.cookiesPath, JSON.stringify(cookieData, null, 2));
            
            console.log('Cookies saved successfully');
        } catch (error) {
            console.error('Error refreshing cookies:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }

    async getCookies() {
        await this.initialize();

        const cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
            
        const cookieHeader = cookieData.cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        Config.setCookies(cookieHeader);

        return Config.cookies;
    }

    async fetchApiData(endpoint, params = {}) {
        console.log(endpoint, params);
        
        try {
            // Load cookies
            const cookieHeader = await this.getCookies();

            console.log("Cookie Header: ", cookieHeader);
            
            // Build URL with query parameters
            const url = new URL(endpoint, Config.getUrl('home')).toString();
            
            console.log(`Fetching API data from: ${url}`);
            
            const data = await RequestManager.fetchApiData(url, params, cookieHeader);

            /*
                LASTLY JUST LIKE HOW ONE CAN CHOOSE IF ONE PREFERS FETCH, ONE SHOULD ALSO BE ABLE TO re-GET THE COOKIES THROUGH PARAMS
            */
            
            return data;
            
        } catch (error) {
            console.error('Error fetching API data:', error.message);
            
            // If unauthorized, try refreshing cookies and try again
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('Authentication error, refreshing cookies and retrying...');
                await this.refreshCookies();
                return this.fetchApiData(endpoint, params); // Recursive retry once
            }
            
            throw error;
        }
    }

    // Direct browser scraping approach
    async scrapeApiData(endpoint, pageUrl, waitTime = 10000) {
        console.log(`Scraping API data from: ${pageUrl}`);
        
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        let apiData = null;
        
        // Set up response intercept
        page.on('response', async (response) => {
            try {
                const url = response.url();
                
                if (url.includes(endpoint)) {
                    console.log(`Intercepted API response: ${url}`);
                    
                    if (response.status() === 200 && 
                        response.headers()['content-type']?.includes('application/json')) {
                        apiData = await response.json();
                        console.log('Successfully captured JSON data');
                    }
                }
            } catch (error) {
                console.error('Error capturing API response:', error.message);
            }
        });
        
        try {
            // Navigate to the page
            await page.goto(pageUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: 60000 
            });
            
            // Wait for potential API calls to complete
            await page.waitForTimeout(waitTime);
            
            // Wait for a common selector to ensure page is loaded
            await page.waitForSelector('body', { timeout: 5000 });
            
        } catch (error) {
            console.error('Error during page scraping:', error.message);
        } finally {
            await browser.close();
        }
        
        return apiData;
    }

    // Convenience methods using cookie-based fetch
    async fetchAiringData(page = 1) {
        return this.fetchApiData('/api', { m: 'airing', page });
    }

    async fetchSearchData(query, page) {
        console.log("Trying to search for", query);
        return this.fetchApiData('/api', { m: 'search', q: query, page });
    }

    async fetchQueueData() {
        return this.fetchApiData('/api', { m: 'queue' });
    }

    async fetchAnimeRelease(id, sort, page) {
        return this.fetchApiData('/api', { m: 'release', id, sort, page });
    }
    
    // Convenience methods using direct scraping
    async scrapeAiringData(page = 1) {
        const pageUrl = `${Config.getUrl('home')}?page=${page}`;
        return this.scrapeApiData('/api?m=airing', pageUrl);
    }
    
        async scrapeAnimeInfo(animeId) {
        const url = `${Config.getUrl('animeInfo')}${animeId}`;

        console.log('Scraping anime info...', url);

        const cookieHeader = await this.getCookies();

        console.log("CookieHeader", cookieHeader);

        const html = await RequestManager.fetch(url, 'default', cookieHeader);

        return html;
    }
    
    async scrapeAnimeList(tag1, tag2) {
        const url = tag1 || tag2 
            ? `${Config.getUrl('animeList', tag1, tag2)}`
            : `${Config.getUrl('animeList')}`;

        console.log(`Fetching anime list at ${url}`);

        const cookieHeader = await this.getCookies();
        
        const html = await RequestManager.fetch(url, 'default', cookieHeader);

        return html;
    }
    
    async scrapeIframe(episodeId) {
        const url = Config.getUrl('play', episodeId);

        console.log('Scraping play page...', url);

        const cookieHeader = await this.getCookies();

        console.log("CookieHeader", cookieHeader);

        const html = await RequestManager.fetch(url, 'default', cookieHeader);

        return html;
    }

    async scrapeSearchData(query) {
        // Create the browser instance with additional options to intercept searches
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        let searchResults = null;
        
        // Set up response listener
        page.on('response', async (response) => {
            try {
                const url = response.url();
                if (url.includes('/api') && url.includes('search')) {
                    if (response.status() === 200 && 
                        response.headers()['content-type']?.includes('application/json')) {
                        searchResults = await response.json();
                        console.log('Search results captured');
                    }
                }
            } catch (error) {
                console.error('Error intercepting search response:', error.message);
            }
        });
        
        try {
            // Navigate to the homepage
            await page.goto(Config.getUrl('home'), { waitUntil: 'domcontentloaded' });
            
            // Find and use the search input
            await page.waitForSelector('input[type="search"], .input-search, input[placeholder*="search"], form input[type="text"]', 
                { timeout: 10000 });
            
            const searchInput = await page.$('input[type="search"], .input-search, input[placeholder*="search"], form input[type="text"]');
            if (searchInput) {
                await searchInput.fill(query);
                await searchInput.press('Enter');
                
                // Wait for results
                await page.waitForTimeout(10000);
            }
            
        } catch (error) {
            console.error('Error performing search scrape:', error.message);
        } finally {
            await browser.close();
        }
        
        return searchResults;
    }

    async getData(type, params, preferFetch = true) {
        console.log(type);
        try {
            // Try the preferred method first
            if (preferFetch) {
                if (type === 'airing') {
                    return await this.fetchAiringData(params.page || 1);
                } else if (type === 'search') {
                    return await this.fetchSearchData(params.query, params.page);
                } else if (type === 'queue') {
                    return await this.fetchQueueData();
                } else if (type === 'releases') {
                    return await this.fetchAnimeRelease(params.animeId, params.sort, params.page);
                }

            } else {
                if (type === 'airing') {
                    return await this.scrapeAiringData(params.page || 1);
                } else if (type === 'search') {
                    return await this.scrapeSearchData(params.query);
                }  else if (type === 'animeList') {
                    return await this.scrapeAnimeList(params.tag1, params.tag2);
                } 
                else if (type === 'animeInfo') {
                    return await this.scrapeAnimeInfo(params.animeId);
                } else if (type === 'play') {
                    return await this.scrapeIframe(params.episodeId)
                }
            }
        } catch (error) {
            console.error(`Error using preferred method (${preferFetch ? 'fetch' : 'scrape'}). Trying fallback...`);
            console.log(error);
            // Fallback to the other method
            if (preferFetch) {
                if (type === 'airing') {
                    return await this.scrapeAiringData(params.page || 1);
                } else if (type === 'search') {
                    return await this.scrapeSearchData(params.query);
                }
            } else {
                if (type === 'airing') {
                    return await this.fetchAiringData(params.page || 1);
                } else if (type === 'search') {
                    return await this.fetchSearchData(params.query);
                }
            }
        }
        
        throw new Error(`Unsupported data type: ${type} (${typeof type})`);
    }
}

module.exports = new ApiClient();