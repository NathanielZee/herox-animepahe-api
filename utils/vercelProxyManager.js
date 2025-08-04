// utils/vercelProxyManager.js - Professional proxy solution for Vercel
const axios = require('axios');
const { CustomError } = require('../middleware/errorHandler');

class VercelProxyManager {
    constructor() {
        // Professional services that actually work
        this.services = {
            scrapingbee: {
                enabled: !!process.env.SCRAPINGBEE_API_KEY,
                baseUrl: 'https://app.scrapingbee.com/api/v1/',
                key: process.env.SCRAPINGBEE_API_KEY
            },
            scraperapi: {
                enabled: !!process.env.SCRAPERAPI_KEY,
                baseUrl: 'http://api.scraperapi.com',
                key: process.env.SCRAPERAPI_KEY
            },
            proxycrawl: {
                enabled: !!process.env.PROXYCRAWL_TOKEN,
                baseUrl: 'https://api.proxycrawl.com/',
                key: process.env.PROXYCRAWL_TOKEN
            }
        };
    }

    async fetchWithScrapingBee(url) {
        if (!this.services.scrapingbee.enabled) {
            throw new Error('ScrapingBee API key not configured');
        }

        console.log('🐝 Using ScrapingBee for:', url);
        
        const params = {
            api_key: this.services.scrapingbee.key,
            url: url,
            render_js: 'true',          // Handle JavaScript challenges
            premium_proxy: 'true',       // Use premium residential IPs
            country_code: 'us',          // Use US IPs
            session_id: 'animepahe_session', // Maintain session
            wait: '3000',               // Wait for page load
            screenshot: 'false',         // Don't need screenshots
            extract_rules: JSON.stringify({
                content: 'body'
            })
        };

        try {
            const response = await axios.get(this.services.scrapingbee.baseUrl, {
                params,
                timeout: 60000,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            // Check if we got actual content (not DDoS-Guard page)
            if (response.data && response.data.length > 1000 && 
                !response.data.includes('DDoS-Guard') && 
                !response.data.includes('checking your browser')) {
                
                console.log('✅ ScrapingBee bypass successful');
                return response.data;
            } else {
                throw new Error('Still blocked by DDoS-Guard');
            }
            
        } catch (error) {
            console.error('❌ ScrapingBee failed:', error.message);
            throw error;
        }
    }

    async fetchWithScraperAPI(url) {
        if (!this.services.scraperapi.enabled) {
            throw new Error('ScraperAPI key not configured');
        }

        console.log('🔧 Using ScraperAPI for:', url);
        
        const params = {
            api_key: this.services.scraperapi.key,
            url: url,
            render: 'true',
            premium: 'true',
            country_code: 'us', 
            session_number: '1'
        };

        try {
            const response = await axios.get(this.services.scraperapi.baseUrl, {
                params,
                timeout: 60000
            });

            if (response.data && response.data.length > 1000 && 
                !response.data.includes('DDoS-Guard')) {
                
                console.log('✅ ScraperAPI bypass successful');
                return response.data;
            } else {
                throw new Error('Still blocked by DDoS-Guard');
            }
            
        } catch (error) {
            console.error('❌ ScraperAPI failed:', error.message);
            throw error;
        }
    }

    async fetchWithProxyCrawl(url) {
        if (!this.services.proxycrawl.enabled) {
            throw new Error('ProxyCrawl token not configured');
        }

        console.log('🕷️ Using ProxyCrawl for:', url);
        
        const params = {
            token: this.services.proxycrawl.key,
            url: url,
            page_wait: '3000',
            ajax_wait: 'true',
            country: 'US'
        };

        try {
            const response = await axios.get(this.services.proxycrawl.baseUrl, {
                params,
                timeout: 60000
            });

            if (response.data && response.data.length > 1000 && 
                !response.data.includes('DDoS-Guard')) {
                
                console.log('✅ ProxyCrawl bypass successful');
                return response.data;
            } else {
                throw new Error('Still blocked by DDoS-Guard');
            }
            
        } catch (error) {
            console.error('❌ ProxyCrawl failed:', error.message);
            throw error;
        }
    }

    async fetch(url, cookieHeader = '', retries = 2) {
        const errors = [];
        
        // Try services in order of reliability
        const servicesToTry = [
            { name: 'ScrapingBee', method: () => this.fetchWithScrapingBee(url) },
            { name: 'ScraperAPI', method: () => this.fetchWithScraperAPI(url) },
            { name: 'ProxyCrawl', method: () => this.fetchWithProxyCrawl(url) }
        ].filter(service => {
            // Only try enabled services
            const serviceName = service.name.toLowerCase().replace(/[^a-z]/g, '');
            return this.services[serviceName]?.enabled;
        });

        if (servicesToTry.length === 0) {
            throw new CustomError(
                'No proxy services configured. Please set SCRAPINGBEE_API_KEY, SCRAPERAPI_KEY, or PROXYCRAWL_TOKEN environment variables.',
                503
            );
        }

        for (const service of servicesToTry) {
            try {
                console.log(`🔄 Trying ${service.name}...`);
                const result = await service.method();
                return result;
            } catch (error) {
                errors.push(`${service.name}: ${error.message}`);
                console.error(`❌ ${service.name} failed:`, error.message);
            }
        }

        // All services failed
        throw new CustomError(
            `All proxy services failed. Errors: ${errors.join('; ')}`,
            503
        );
    }

    static async fetchApiData(url, params = {}, cookieHeader = '') {
        const manager = new VercelProxyManager();
        
        // Build full URL with parameters
        const fullUrl = new URL(url);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                fullUrl.searchParams.append(key, params[key]);
            }
        });
        
        return await manager.fetch(fullUrl.toString(), cookieHeader);
    }
}

module.exports = VercelProxyManager;
