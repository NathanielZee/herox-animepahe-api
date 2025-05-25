class Config {
    constructor() {
        this.hostUrl = '';
        this.baseUrl = 'https://animepahe.ru'; 
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.cookies = '';
        this.proxies = [];
    }

    setHostUrl(protocol, host) {
        if (!this.hostUrl && protocol && host) {
          this.hostUrl = `${protocol}://${host}`;
          console.log(`Host URL set to: ${this.hostUrl}`);
        }
    }

    setCookies(cookieHeader) {
        if(!cookieHeader) {
            console.log("Cookie Header missing");
        } else {
            console.log("Cookies Set!");
            this.cookies = cookieHeader;
        }
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

    getUrl(section, primary = '', secondary = '') {
        const paths = {
            home: '/',
            queue: '/queue',
            animeInfo: `/anime/${primary}`, 
            animeList: primary && secondary ? `/anime/${primary}/${secondary}` : '/anime', 
            play: `/play/${primary}/${secondary}`
        };

        if (!paths[section]) {
            throw new Error(`Invalid section: ${section}`);
        }

        return `${this.baseUrl}${paths[section]}`;
    }

    loadFromEnv() {
        if (process.env.BASE_URL) {
            this.baseUrl = process.env.BASE_URL;
        }
        if (process.env.USER_AGENT) {
            this.userAgent = process.env.USER_AGENT;
        }
        if (process.env.HOST_URL) {
            this.hostUrl = process.env.HOST_URL;
        }
        if (process.env.COOKIES) {
            this.cookies = process.env.COOKIES;
        }
        if (process.env.PROXIES) {
            this.proxies = process.env.PROXIES.split(',');
        }
        if (process.env.USE_PROXY === 'true') {
            this.proxyEnabled = true;
        }
    }

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
module.exports = config;