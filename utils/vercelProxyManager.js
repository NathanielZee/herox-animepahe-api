// utils/vercelProxyManager.js - Enhanced with stealth proxy support
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

    async fetchWithScrapingBee(url, mode = 'basic') {
        if (!this.services.scrapingbee.enabled) {
            throw new Error('ScrapingBee API key not configured');
        }

        console.log(`🐝 Using ScrapingBee in ${mode} mode for:`, url);
        console.log('🐝 API Key (first 10 chars):', this.services.scrapingbee.key.substring(0, 10) + '...');
        
        // FIXED: Use correct parameter names and values
        let params = {
            api_key: this.services.scrapingbee.key,
            url: url, // Don't double-encode - axios will handle this
            country_code: 'us'
        };

        // Configure parameters based on mode - FIXED parameter names
        switch (mode) {
            case 'stealth':
                console.log('🥷 Using STEALTH mode - 75 credits per request');
                params = {
                    ...params,
                    stealth_proxy: true,        // Boolean, not string
                    render_js: true,            // Boolean, not string
                    wait: 3000,                // Number, not string
                    block_resources: false,     // Boolean, not string
                    premium_proxies: true       // FIXED: premium_proxies (plural)
                };
                break;
                
            case 'premium':
                console.log('💎 Using PREMIUM mode - 25 credits per request');
                params = {
                    ...params,
                    premium_proxies: true,      // FIXED: premium_proxies (plural)
                    render_js: true,            // Boolean, not string
                    wait: 2000,                // Number, not string
                    block_resources: false      // Boolean, not string
                };
                break;
                
            case 'basic':
            default:
                console.log('🔰 Using BASIC mode - 1 credit per request');
                params = {
                    ...params,
                    render_js: false,           // Boolean, not string
                    premium_proxies: false,     // FIXED: premium_proxies (plural)
                    block_resources: true       // Boolean, not string
                };
                break;
        }

        console.log('🐝 Request params:', { ...params, api_key: 'HIDDEN' });

        try {
            const response = await axios.get(this.services.scrapingbee.baseUrl, {
                params,
                timeout: mode === 'stealth' ? 60000 : 30000, // Longer timeout for stealth
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            console.log('🐝 ScrapingBee response status:', response.status);
            console.log('🐝 ScrapingBee response headers:', JSON.stringify(response.headers, null, 2));
            
            if (response.data && response.data.length > 100) {
                const isDDoSBlocked = response.data.includes('DDoS-Guard') || 
                                     response.data.includes('checking your browser') ||
                                     response.data.includes('ddos-guard');
                
                console.log('🐝 Response length:', response.data.length);
                console.log('🐝 Contains DDoS-Guard:', isDDoSBlocked);
                console.log('🐝 Response preview:', response.data.substring(0, 300));
                
                if (!isDDoSBlocked) {
                    console.log(`✅ ScrapingBee ${mode} mode bypass successful`);
                    return response.data;
                } else {
                    console.log(`❌ ScrapingBee ${mode} mode still blocked by DDoS-Guard`);
                    throw new Error(`Still blocked by DDoS-Guard in ${mode} mode`);
                }
            } else {
                throw new Error('Response too short or empty');
            }
            
        } catch (error) {
            console.error(`❌ ScrapingBee ${mode} mode detailed error:`, {
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
        
        // FIXED: Use correct parameter format for ScraperAPI
        const params = {
            api_key: this.services.scraperapi.key,
            url: url, // Don't double-encode - axios will handle this
            render: true,                  // Boolean, not string
            premium: true,                 // Boolean, not string  
            country_code: 'us',
            session_number: Math.floor(Math.random() * 1000) // Random session
        };

        console.log('🔧 Request params:', { ...params, api_key: 'HIDDEN' });

        try {
            const response = await axios.get(this.services.scraperapi.baseUrl, {
                params,
                timeout: 45000, // Longer timeout for JS rendering
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            console.log('🔧 ScraperAPI response status:', response.status);
            console.log('🔧 Response headers:', JSON.stringify(response.headers, null, 2));

            if (response.data && response.data.length > 100) {
                const isDDoSBlocked = response.data.includes('DDoS-Guard') ||
                                     response.data.includes('checking your browser');
                
                console.log('🔧 Response length:', response.data.length);
                console.log('🔧 Contains DDoS-Guard:', isDDoSBlocked);
                console.log('🔧 Response preview:', response.data.substring(0, 300));
                
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
        const isAnimePahe = url.includes('animepahe');
        
        console.log(`🔍 Starting fetch for ${isAnimePahe ? 'AnimePahe' : 'other site'}: ${url}`);
        
        // First test API keys
        console.log('🔍 Testing API keys before attempting requests...');
        const keyTests = await this.testApiKeys();
        
        // Define service attempts with escalating power for AnimePahe
        let servicesToTry = [];
        
        if (isAnimePahe) {
            console.log('🎯 AnimePahe detected - using escalating strategy');
            // For AnimePahe, try stealth mode first, then premium, then basic
            if (this.services.scrapingbee.enabled && keyTests.scrapingbee.working) {
                servicesToTry.push(
                    { name: 'ScrapingBee Stealth', method: () => this.fetchWithScrapingBee(url, 'stealth') },
                    { name: 'ScrapingBee Premium', method: () => this.fetchWithScrapingBee(url, 'premium') }
                );
            }
            if (this.services.scraperapi.enabled && keyTests.scraperapi.working) {
                servicesToTry.push(
                    { name: 'ScraperAPI Premium', method: () => this.fetchWithScraperAPI(url) }
                );
            }
        } else {
            console.log('🌐 Regular site - using basic strategy');
            // For other sites, try basic mode first
            if (this.services.scrapingbee.enabled && keyTests.scrapingbee.working) {
                servicesToTry.push(
                    { name: 'ScrapingBee Basic', method: () => this.fetchWithScrapingBee(url, 'basic') }
                );
            }
            if (this.services.scraperapi.enabled && keyTests.scraperapi.working) {
                servicesToTry.push(
                    { name: 'ScraperAPI Basic', method: () => this.fetchWithScraperAPI(url) }
                );
            }
        }

        if (servicesToTry.length === 0) {
            const keyErrors = [];
            if (!keyTests.scrapingbee.working && this.services.scrapingbee.enabled) {
                keyErrors.push(`ScrapingBee: ${keyTests.scrapingbee.error}`);
            }
            if (!keyTests.scraperapi.working && this.services.scraperapi.enabled) {
                keyErrors.push(`ScraperAPI: ${keyTests.scraperapi.error}`);
            }
            
            throw new CustomError(
                `No working proxy services available. Errors: ${keyErrors.join('; ')}`,
                503
            );
        }

        // Try each service in order
        for (const service of servicesToTry) {
            try {
                console.log(`🔄 Trying ${service.name}...`);
                const result = await service.method();
                console.log(`✅ ${service.name} succeeded!`);
                return result;
            } catch (error) {
                errors.push(`${service.name}: ${error.message}`);
                console.error(`❌ ${service.name} failed:`, error.message);
                
                // For AnimePahe, if stealth fails, we still try other methods
                // For other sites, we might want to fail faster
                if (!isAnimePahe && service.name.includes('Basic')) {
                    console.log('🔄 Basic mode failed for regular site, trying premium methods...');
                }
            }
        }

        throw new CustomError(
            `All proxy services failed for ${isAnimePahe ? 'AnimePahe' : 'site'}. Errors: ${errors.join('; ')}`,
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
