const { chromium } = require('playwright');
const Config = require('../utils/config');

class ApiScraper {
    static async fetchApiData() {
        console.log('Fetching main page and intercepting API requests...');
        
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        let jsonResponse = null;

        page.on('response', async (response) => {
            try {
                const url = response.url();
                console.log(url);
                if (url.includes('/api?m=airing')) {
                    console.log(`Intercepted API response: ${url}`);
                    
                    if (response.status() === 200 && response.headers()['content-type'].includes('application/json')) {
                        jsonResponse = await response.json();
                        console.log('Successfully captured JSON data:', jsonResponse);
                    }
                }
            } catch (error) {
                console.error('Error capturing API response:', error.message);
            }
        }); 

        try {
            await page.goto(Config.getUrl('home'), { waitUntil: 'domcontentloaded', timeout: 120000 });
            
            await page.waitForTimeout(10000); 

            console.log('Waiting for selector..');

            await page.waitForSelector('.episode-wrap, .episode-list', { timeout: 60000 });

            console.log("Selector found?");

        } catch (error) {
            console.error('Error loading main page:', error.message);
        } finally {
            await browser.close();
        }

        return jsonResponse; // Return the intercepted API data
    }
}

module.exports = ApiScraper;
