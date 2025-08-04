// utils/vercelProxyManager.js - Enhanced diagnostics version
const axios = require('axios');
const { CustomError } = require('../middleware/errorHandler');

class VercelProxyManager {
    constructor() {
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
            }
        };
    }

    async fetchWithScrapingBee(url) {
        if (!this.services.scrapingbee.enabled) {
            throw new Error('ScrapingBee API key not configured');
        }

        console.log('🐝 Using ScrapingBee for:', url);
        console.log('🐝 API Key (first 10 chars):', this.services.scrapingbee.key.substring(0, 10) + '...');
        
        // Simplified parameters for initial test
        const params = {
            api_key: this.services.scrapingbee.key,
            url: url,
            render_js: 'false',     // Disable JS rendering for initial test
            premium_proxy: 'false', // Disable premium proxy for initial test
            country_code: 'us'
        };

        console.log('🐝 Request params:', { ...params, api_key: 'HIDDEN' });

        try {
            const response = await axios.get(this.services.scrapingbee.baseUrl, {
                params,
                timeout: 30000,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            console.log('🐝 ScrapingBee response status:', response.status);
            console.log('🐝 Response headers:', JSON.stringify(response.headers, null, 2));
            
            if (response.data && response.data.length > 500) {
                const isDDoSBlocked = response.data.includes('DDoS-Guard') || 
                                     response.data.includes('checking your browser');
                
                console.log('🐝 Response length:', response.data.length);
                console.log('🐝 Contains DDoS-Guard:', isDDoSBlocked);
                console.log('🐝 Response preview:', response.data.substring(0, 200));
                
                if (!isDDoSBlocked) {
                    console.log('✅ ScrapingBee bypass successful');
                    return response.data;
                } else {
                    throw new Error('Still blocked by DDoS-Guard');
                }
            } else {
                throw new Error('Response too short or empty');
            }
            
        } catch (error) {
            console.error('❌ ScrapingBee detailed error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No data',
                headers: error.response?.headers
            });
            throw error;
        }
    }

    async fetchWithScraperAPI(url) {
        if (!this.services.scraperapi.enabled) {
            throw new Error('ScraperAPI key not configured');
        }

        console.log('🔧 Using ScraperAPI for:', url);
        console.log('🔧 API Key (first 10 chars):', this.services.scraperapi.key.substring(0, 10) + '...');
        
        // Simplified parameters for initial test
        const params = {
            api_key: this.services.scraperapi.key,
            url: url,
            render: 'false',        // Disable JS rendering for initial test
            premium: 'false',       // Disable premium for initial test
            country_code: 'us'
        };

        console.log('🔧 Request params:', { ...params, api_key: 'HIDDEN' });

        try {
            const response = await axios.get(this.services.scraperapi.baseUrl, {
                params,
                timeout: 30000
            });

            console.log('🔧 ScraperAPI response status:', response.status);
            console.log('🔧 Response headers:', JSON.stringify(response.headers, null, 2));

            if (response.data && response.data.length > 500) {
                const isDDoSBlocked = response.data.includes('DDoS-Guard');
                
                console.log('🔧 Response length:', response.data.length);
                console.log('🔧 Contains DDoS-Guard:', isDDoSBlocked);
                console.log('🔧 Response preview:', response.data.substring(0, 200));
                
                if (!isDDoSBlocked) {
                    console.log('✅ ScraperAPI bypass successful');
                    return response.data;
                } else {
                    throw new Error('Still blocked by DDoS-Guard');
                }
            } else {
                throw new Error('Response too short or empty');
            }
            
        } catch (error) {
            console.error('❌ ScraperAPI detailed error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No data',
                headers: error.response?.headers
            });
            throw error;
        }
    }

    // Test API keys with a simple request first
    async testApiKeys() {
        const results = {
            scrapingbee: { working: false, error: null },
            scraperapi: { working: false, error: null }
        };

        // Test ScrapingBee with a simple URL
        if (this.services.scrapingbee.enabled) {
            try {
                console.log('🐝 Testing ScrapingBee API key...');
                const response = await axios.get(this.services.scrapingbee.baseUrl, {
                    params: {
                        api_key: this.services.scrapingbee.key,
                        url: 'https://httpbin.org/get'  // Simple test URL
                    },
                    timeout: 15000
                });
                
                if (response.status === 200) {
                    results.scrapingbee.working = true;
                    console.log('✅ ScrapingBee API key is valid');
                }
            } catch (error) {
                results.scrapingbee.error = `${error.response?.status}: ${error.response?.data || error.message}`;
                console.error('❌ ScrapingBee API key test failed:', results.scrapingbee.error);
            }
        }

        // Test ScraperAPI with a simple URL
        if (this.services.scraperapi.enabled) {
            try {
                console.log('🔧 Testing ScraperAPI key...');
                const response = await axios.get(this.services.scraperapi.baseUrl, {
                    params: {
                        api_key: this.services.scraperapi.key,
                        url: 'https://httpbin.org/get'  // Simple test URL
                    },
                    timeout: 15000
                });
                
                if (response.status === 200) {
                    results.scraperapi.working = true;
                    console.log('✅ ScraperAPI key is valid');
                }
            } catch (error) {
                results.scraperapi.error = `${error.response?.status}: ${error.response?.data || error.message}`;
                console.error('❌ ScraperAPI key test failed:', results.scraperapi.error);
            }
        }

        return results;
    }

    async fetch(url, cookieHeader = '', retries = 1) {
        const errors = [];
        
        // First test API keys
        console.log('🔍 Testing API keys before attempting requests...');
        const keyTests = await this.testApiKeys();
        
        const servicesToTry = [
            { name: 'ScrapingBee', method: () => this.fetchWithScrapingBee(url), test: keyTests.scrapingbee },
            { name: 'ScraperAPI', method: () => this.fetchWithScraperAPI(url), test: keyTests.scraperapi }
        ].filter(service => {
            const serviceName = service.name.toLowerCase().replace(/[^a-z]/g, '');
            const isEnabled = this.services[serviceName]?.enabled;
            const keyWorks = service.test.working;
            
            if (isEnabled && !keyWorks) {
                errors.push(`${service.name}: API key invalid - ${service.test.error}`);
            }
            
            return isEnabled && keyWorks;
        });

        if (servicesToTry.length === 0) {
            throw new CustomError(
                `No working proxy services available. Errors: ${errors.join('; ')}`,
                503
            );
        }

        for (const service of servicesToTry) {
            try {
                console.log(`🔄 Trying ${service.name} with working API key...`);
                const result = await service.method();
                return result;
            } catch (error) {
                errors.push(`${service.name}: ${error.message}`);
                console.error(`❌ ${service.name} failed:`, error.message);
            }
        }

        throw new CustomError(
            `All proxy services failed. Errors: ${errors.join('; ')}`,
            503
        );
    }

    static async fetchApiData(url, params = {}, cookieHeader = '') {
        const manager = new VercelProxyManager();
        
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
