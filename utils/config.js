const ProxyManager = require('./proxyManager');

class Config {
    constructor() {
        this.hostUrl = '';
        this.baseUrl = 'https://animepahe.ru'; 
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.proxies = [];
    }

    setHostUrl(protocol, host) {
        if (!this.hostUrl && protocol && host) {
          this.hostUrl = `${protocol}://${host}`;
          console.log(`Host URL set to: ${this.hostUrl}`);
        }
    }

    async initialize() {
        this.proxies = await ProxyManager.fetchProxies();
    }

    getRandomProxy() {
        if (this.proxies.length === 0) {
            console.log('No proxies available.');
        }
        return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    // Method to update proxies dynamically
    updateProxies(newProxies) {
        this.proxies = newProxies;
    }

    getUrl(section, id = '') {
        const paths = {
            home: '/',
            queue: '/queue',
            animeInfo: `/anime/${id}`, 
            play: `/play/${id}`
        };

        if (!paths[section]) {
            throw new Error(`Invalid section: ${section}`);
        }

        return `${this.baseUrl}${paths[section]}`;
    }

    // Method to load configuration from environment variables
    loadFromEnv() {
        if (process.env.BASE_URL) {
            this.baseUrl = process.env.BASE_URL;
        }
        if (process.env.USER_AGENT) {
            this.userAgent = process.env.USER_AGENT;
        }
    }

    // Method to validate configuration
    validate() {
        if (!this.baseUrl) {
            throw new Error('Base URL is required in configuration.');
        }
        if (!this.userAgent) {
            throw new Error('User-Agent is required in configuration.');
        }
    }
}

const config = new Config();
config.initialize().catch(err => console.error('Failed to initialize config:', err));

module.exports = config;