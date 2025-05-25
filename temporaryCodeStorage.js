const { chromium } = require('playwright');
const Config = require('../utils/config');

class ApiScraper {
    static async fetchApiData(endpoint, pageIndex) {
        console.log('Fetching main page and intercepting API requests...');

        const proxy = Config.getRandomProxy();
        // console.log(`Using proxy: ${proxy || 'none'}`);
        
        const browser = await chromium.launch({ 
            headless: true,
            // proxy: proxy ? {
            //     server: proxy,
            // } : undefined,
        });
        const page = await browser.newPage();

        let jsonResponse = null;

        page.on('response', async (response) => {
            try {
                const url = response.url();
                console.log(url);
                if (url.includes(endpoint)) {
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
            await page.goto(`${Config.getUrl('home')}?page=${pageIndex}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
            
            await page.waitForTimeout(30000); 

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
    // Add a new method specifically for search
    static async fetchSearchData(searchQuery) {
        console.log(`Searching for: "${searchQuery}" and intercepting API requests...`);
        
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Store API responses
        let searchResults = null;
        
        // Set up response listener before navigation
        page.on('response', async (response) => {
            try {
                const url = response.url();
                
                // Look for search-related API calls
                if (url.includes('/api') && url.includes('search')) {
                    console.log(`Intercepted search API: ${url}`);
                    
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
            // First, navigate to the homepage
            await page.goto(Config.getUrl('home'), { 
                waitUntil: 'domcontentloaded', 
                timeout: 30000 
            });
            
            // Locate the search input and perform a search
            await page.waitForSelector('input[type="search"], .input-search, input[placeholder*="search"], form input[type="text"]', { timeout: 10000 });
            
            // Fill and submit the search form
            const searchInput = await page.$('input[type="search"], input-search, input[placeholder*="search"], form input[type="text"]');
            if (searchInput) {
                await searchInput.fill(searchQuery);
                await searchInput.press('Enter');
                
                // Wait for results to load (adjust selector as needed)
                await page.waitForSelector('.search-results-wrap .search-results, li', { 
                    timeout: 20000,
                    state: 'attached'
                }).catch(() => console.log('Search results selector not found, continuing anyway'));
                
                // Additional wait for network activity to settle
                await page.waitForTimeout(5000);
            } else {
                console.error('Search input not found');
            }
            
        } catch (error) {
            console.error('Error during search operation:', error.message);
        } finally {
            await browser.close();
        }

        return searchResults;
    }

    // Helper method to analyze the site and find the search elements
    static async analyzeSearchElements() {
        console.log('Analyzing site to identify search elements...');
        
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        
        try {
            await page.goto(Config.getUrl('home'), { waitUntil: 'networkidle' });
            
            // Find all potential search inputs
            const potentialSearchInputs = await page.$$eval('input[type], form input, button:has-text("Search")', 
                elements => elements.map(el => ({
                    type: el.type || 'none',
                    id: el.id || 'none',
                    name: el.name || 'none',
                    placeholder: el.placeholder || 'none',
                    class: el.className || 'none',
                    parentTag: el.parentElement?.tagName.toLowerCase() || 'none',
                    parentClass: el.parentElement?.className || 'none'
                }))
            );
            
            console.log('Potential search elements found:', potentialSearchInputs);
            
            // Keep browser open for debugging
            await page.waitForTimeout(10000);
            
        } catch (error) {
            console.error('Error analyzing search elements:', error.message);
        } finally {
            await browser.close();
        }
    }
}

const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  try {
    const response = await axios.get('https://example.com', {
      headers: {
        'Referer': 'https://google.com/',  // or whatever referrer is appropriate
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const title = $('title').text();
    console.log('Page Title:', title);

  } catch (error) {
    console.error('Error fetching the page:', error.message);
  }
})();

module.exports = ApiScraper;
