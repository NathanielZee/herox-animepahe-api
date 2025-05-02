const { chromium } = require('playwright');
const cheerio = require('cheerio');
const axios = require('axios');
const Config = require('./config');

class RequestManager {
    static async fetch(url, type, cookieHeader) {
        if (type === 'json') {
            return this.fetchApiData(url, null, null);
        } else if (type === 'heavy') {
            return this.scrapeWithPlaywright(url);
        } else if (type === 'default') {
            // const cookieHeader = Config.cookies;
            return this.scrapeWithCheerio(url, cookieHeader);
        }  else {
            console.trace('Invalid fetch type specified. Please use "json", "heavy", or "default".');
            return null;
        }
    }

    static async scrapeWithCheerio(url, cookieHeader) {
        if(!cookieHeader) {
            console.log("cookies is empty");
        }
        console.log("CookieHeader". cookieHeader);
        const html = await this.fetchApiData(url, {}, cookieHeader);
        
        console.log(html);

        // Load the HTML into Cheerio
        // const $ = cheerio.load(html);

        // const pageHtml = $.html();

        // Return the HTML content
        return cheerio.load(html);
    }

    static async scrapeWithPlaywright(url) {
        console.log('Fetching content from:', url);

        const proxy = Config.getRandomProxy();
        // console.log(`Using proxy: ${proxy || 'none'}`);

        const browser = await chromium.launch({
            headless: true,
            // proxy: proxy ? {
            //     server: proxy,
            // } : undefined,
        });

        try {
            console.log('Creating new page..');
            const page = await browser.newPage();

            // Add stealth measures
            await page.addInitScript(() => {
                delete navigator.__proto__.webdriver;
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3],
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Add more stealth measures
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            });

            // Set realistic headers
            await page.setExtraHTTPHeaders({
                'User-Agent': Config.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/',
                'Cache-Control': 'no-cache'
            });

            console.log('Navigating to url..');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Wait for DDoS protection to clear
            await page.waitForTimeout(10000);

            console.log('Waiting for content..');
            
            // Determine if we're looking for API or HTML content
            const isApiRequest = url.includes('/api') || url.endsWith('.json');
            
            if (!isApiRequest) {
                // For HTML content, wait for selectors
                try {
                    await page.waitForSelector('.episode-wrap, .episode-list', { 
                        timeout: 60000 
                    }).catch(e => {
                        console.log('Specific selector not found, continuing anyway');
                    });
                } catch (error) {
                    console.log('Waiting for content failed:', error.message);
                }
            } else {
                // For API content, wait for body to contain JSON
                try {
                    await page.waitForFunction(() => {
                        const text = document.body.textContent;
                        return text.includes('{') && text.includes('}');
                    }, { timeout: 60000 }).catch(e => {
                        console.log('JSON content not found, continuing anyway');
                    });
                } catch (error) {
                    console.log('Waiting for API content failed:', error.message);
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
    }

    static async fetchApiData(url, params, cookieHeader) {
            
            try {
                const response = await axios({
                    method: 'get',
                    url: url,
                    params: params,
                    headers: {
                        'Cookie': cookieHeader,
                        'User-Agent': Config.userAgent,
                        'Referer': Config.getUrl('home'),
                        'Origin': Config.getUrl('home'),
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                });
    
                return response.data;
                
            } catch (error) {
                console.error('Error fetching API data:', error.message);
                
                throw error;
            }
        }
}

module.exports = RequestManager;