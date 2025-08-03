const { launchBrowser } = require('./browser');
const cheerio = require('cheerio');
const axios = require('axios');
const Config = require('./config');
const { CustomError } = require('../middleware/errorHandler');

class RequestManager {
    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Retry with exponential backoff
    static async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (error?.response?.status === 404 || 
                    error?.response?.status === 401) {
                    throw error;
                }
                
                if (attempt === maxRetries) {
                    console.error(`All ${maxRetries} attempts failed. Last error:`, error.message);
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this.delay(delay);
            }
        }
        
        throw lastError;
    }

    static async fetch(url, cookieHeader, type = 'default') {
        return this.retry(async () => {
            if (type === 'default') {
                return this.fetchApiData(url, {}, cookieHeader);
            } else if (type === 'heavy') {
                return this.scrapeWithPlaywright(url);
            } else {
                throw new Error('Invalid fetch type specified. Please use "default" or "heavy".');
            }
        }, 3, 1000);
    }

    static async scrapeWithPlaywright(url) {
        console.log('Fetching content from:', url);
        const proxy = Config.proxyEnabled ? Config.getRandomProxy() : null;
        console.log(`Using proxy: ${proxy || 'none'}`);

        let browser = null;
        let context = null;
        let page = null;

        try {
            // Launch browser with timeout
            browser = await Promise.race([
                launchBrowser(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Browser launch timeout')), 30000)
                )
            ]);

            const contextOptions = {
                userAgent: Config.userAgent,
                viewport: { width: 1920, height: 1080 }
            };

            if (proxy) {
                contextOptions.proxy = { server: proxy };
            }

            context = await browser.newContext(contextOptions);
            
            // Set timeout for context
            context.setDefaultTimeout(60000);
            context.setDefaultNavigationTimeout(60000);

            page = await context.newPage();

            // Add stealth measures
            await page.addInitScript(() => {
                delete navigator.__proto__.webdriver;
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            });

            // Set realistic headers
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            });

            console.log('Navigating to URL...');
            
            // Navigate with timeout and retries
            await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: 45000 
            });

            // Wait for page to be ready
            await this.delay(3000);

            // Check if we hit anti-bot measures
            const title = await page.title();
            const content = await page.content();
            
            if (title.includes('DDoS') || content.includes('checking your browser')) {
                console.log('Detected anti-bot protection, waiting...');
                await this.delay(10000);
                
                // Try to wait for the real content
                try {
                    await page.waitForSelector('body', { timeout: 20000 });
                } catch (e) {
                    console.log('Timeout waiting for content, proceeding...');
                }
            }

            const finalContent = await page.content();
            
            // Basic validation
            if (finalContent.length < 1000) {
                throw new Error('Page content too short, might be blocked');
            }

            return finalContent;

        } catch (error) {
            console.error('Playwright scraping error:', error.message);
            throw new CustomError(`Failed to scrape page: ${error.message}`, 503);
        } finally {
            // Always cleanup
            try {
                if (page) await page.close();
                if (context) await context.close();
                if (browser) await browser.close();
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError.message);
            }
        }
    }

    static async fetchApiData(url, params = {}, cookieHeader) {
        if (!cookieHeader) {
            throw new CustomError('Authentication required', 403);
        }
        
        try {
            const requestConfig = {
                params: params,
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': Config.getUrl('home'),
                    'User-Agent': Config.userAgent,
                    'Cookie': cookieHeader
                },
                timeout: 15000, // 15 second timeout
                validateStatus: (status) => status < 500 // Don't throw on 4xx errors
            };

            // Add proxy if enabled
            if (Config.proxyEnabled) {
                const proxyUrl = Config.getRandomProxy();
                if (proxyUrl) {
                    const [host, port] = proxyUrl.replace(/^https?:\/\//, '').split(':');
                    requestConfig.proxy = {
                        host: host,
                        port: parseInt(port),
                        protocol: 'http'
                    };
                }
            }

            const response = await axios.get(url, requestConfig);

            // Check for anti-bot measures
            const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            
            if (responseText.includes('DDoS-GUARD') || 
                responseText.includes('checking your browser') ||
                response.status === 403) {
                throw new CustomError('Anti-bot protection detected', 403);
            }

            if (response.status === 404) {
                throw new CustomError('Resource not found', 404);
            }

            if (response.status >= 400) {
                throw new CustomError(`HTTP ${response.status}: ${response.statusText}`, response.status);
            }

            return response.data;

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new CustomError('Request timeout', 408);
            }
            
            if (error.code === 'ECONNREFUSED') {
                throw new CustomError('Connection refused', 503);
            }

            if (error instanceof CustomError) {
                throw error;
            }

            throw new CustomError(`Request failed: ${error.message}`, error.response?.status || 503);
        }
    }

    static async fetchJson(url) {
        return this.retry(async () => {
            const html = await this.fetch(url);
            
            try {
                // Try to parse the content as JSON
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