const axios = require('axios');

class ProxyManager {
    static async fetchProxies() {
        const proxySources = [
            'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=elite',
            'https://www.proxy-list.download/api/v1/get?type=http',
            'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list.txt',
        ];
    
        const proxies = new Set();
    
        for (const source of proxySources) {
            try {
                const response = await axios.get(source);
                const newProxies = response.data.split('\n')
                    .map(proxy => proxy.trim())
                    .filter(proxy => proxy !== '');
                newProxies.forEach((proxy) => {if(this.validateProxy(proxy)){proxies.add(proxy)}});
            } catch (error) {
                console.error(`Failed to fetch proxies from ${source}:`, error.message);
            }
        }
    
        console.log('Validated Proxies:', Array.from(proxies));
        return Array.from(proxies);
    };

    static async validateProxy(proxy) {
        try {
            const response = await axios.get('https://httpbin.org/ip', {
                proxy: {
                    host: proxy.split(':')[0],
                    port: parseInt(proxy.split(':')[1], 10),
                },
                timeout: 15000, // 15-second timeout
            });
            console.log(`Proxy ${proxy} is working. IP:`, response.data.origin);
            return true;
        } catch (error) {
            console.error(`Proxy ${proxy} failed:`, error.message);
            return false;
        }
    }
    
}

module.exports = ProxyManager;