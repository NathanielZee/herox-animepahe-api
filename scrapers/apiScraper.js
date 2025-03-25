const { chromium } = require('playwright');
const Config = require('../utils/config');

class ApiScraper {
    static async fetchApiData(endpoint, pageIndex) {
        console.log(`Fetching page ${pageIndex} and intercepting API requests...`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Use an array to collect all matching JSON responses
        const apiResponses = [];

        // Intercept all responses
        page.on('response', async (response) => {
            try {
                const url = response.url();
                
                // More flexible matching for the endpoint
                if (url.includes(endpoint)) {
                    console.log(`Potential API response found: ${url}`);
                    
                    // Ensure it's a successful JSON response
                    if (response.status() === 200 && 
                        response.headers()['content-type']?.includes('application/json')) {
                        
                        try {
                            const jsonData = await response.json();
                            
                            // Only add non-empty responses
                            if (jsonData && (Array.isArray(jsonData) ? jsonData.length > 0 : Object.keys(jsonData).length > 0)) {
                                console.log('Captured valid JSON data');
                                apiResponses.push(jsonData);
                            }
                        } catch (parseError) {
                            console.error('Error parsing JSON:', parseError.message);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in response intercept:', error.message);
            }
        });

        try {
            // Navigate with page index
            await page.goto(`${Config.getUrl('home')}?page=${pageIndex}`, { 
                waitUntil: 'networkidle', 
                timeout: 60000 
            });

            // Wait for potential network activity
            await page.waitForTimeout(10000);

            // Add fallback mechanism to ensure we've captured data
            if (apiResponses.length === 0) {
                console.warn('No API responses captured. Retrying...');
            }

        } catch (error) {
            console.error('Error loading main page:', error.message);
        } finally {
            await browser.close();
        }

        // Return all captured responses or null
        return apiResponses.length > 0 ? apiResponses : null;
    }
}

module.exports = ApiScraper;