const { launchBrowser } = require('./browser');
const cheerio = require('cheerio');
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    static async fetch(url, cookieHeader, type = 'default') {
        if (type === 'default') {
            return this.fetchApiData(url, {}, cookieHeader);
        } else if (type === 'heavy') {
            return this.scrapeWithPlaywright(url);
        } else {
            console.trace('Invalid fetch type specified. Please use "json", "heavy", or "default".');
            return null;
        }
    }

    static async scrapeWithPlaywright(url) {
        console.log('Fetching content from:', url);
        const proxy = Config.proxyEnabled ? Config.getRandomProxy() : null;
        console.log(`Using proxy: ${proxy || 'none'}`);

        const browser = await launchBrowser();

        try {
        const contextOptions = {};

        if (proxy) {
            contextOptions.proxy = { server: proxy };
        }

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();

        // Stealth measures
        await page.addInitScript(() => {
            delete navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3],
            });
            Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            });

            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);
        });

        // Realistic headers
        await page.setExtraHTTPHeaders({
            'User-Agent': Config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache',
        });

        console.log('Navigating to URL...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

        await page.waitForTimeout(10000); // DDoS challenge buffer

        const isApiRequest = url.includes('/api') || url.endsWith('.json');

        if (!isApiRequest) {
            try {
            await page.waitForSelector('.episode-wrap, .episode-list', { timeout: 60000 });
            } catch (e) {
            console.log('Selector not found, continuing...');
            }
        } else {
            try {
            await page.waitForFunction(() => {
                const text = document.body.textContent;
                return text.includes('{') && text.includes('}');
            }, { timeout: 60000 });
            } catch (e) {
            console.log('API content not found, continuing...');
            }
        }

        const content = await page.content();
        return content;
        } finally {
        await browser.close();
        }
    }

    static async fetchJson(url) {
        const html = await this.fetch(url);
        
        try {
            // Try to parse the content as JSON
            const jsonMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) || 
                             html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1].trim());
                } catch (e) {
                    console.log('Failed to parse JSON from matched content, trying whole page');
                    return JSON.parse(html);
                }
            } else {
                return JSON.parse(html);
            }
        } catch (error) {
            console.error('Failed to parse JSON:', error.message);
            throw new Error(`Failed to parse JSON from ${url}: ${error.message}`);
        }
    }      static async fetchApiData(url, params = {}, cookieHeader) {
        try {
            if (!cookieHeader) {
                throw new CustomError('DDoS-Guard authentication required', 403);
            }
            
            const proxyUrl = Config.proxyEnabled ? Config.getRandomProxy() : null;
            const [proxyHost, proxyPort] = proxyUrl ? proxyUrl.split(':') : [null, null];

            console.log(`Using proxy: ${proxyUrl || 'none'}`);
            if (proxyHost && !proxyPort) {
                throw new CustomError('Invalid proxy format. Expected format: host:port', 400);
            }

            const response = await axios.get(url, {
                params: params,
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': Config.getUrl('home'),
                    'User-Agent': Config.userAgent,
                    'Cookie': cookieHeader
                },
                proxy: proxyUrl ? {
                    host: proxyHost,
                    port: parseInt(proxyPort),
                    protocol: 'http'
                } : false
            });

            const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            if (responseText.includes('DDoS-GUARD') || 
                responseText.includes('checking your browser') ||
                response.status === 403) {
                // This will trigger a cookie refresh in Animepahe.fetchApiData
                throw new CustomError('DDoS-Guard authentication required, valid cookies required', 403);
            }

            return response.data;
        } catch (error) {
            if (error.response?.status === 403) {
                // Let Animepahe handle the cookie refresh
                throw new CustomError('DDoS-Guard authentication required, invalid cookies', 403);
            }
            if (error.response?.status === 404) {
                throw new CustomError('Resource not found', 404);
            }
            throw error;
        }
    }
}

module.exports = RequestManager;