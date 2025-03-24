const axios = require('axios');
const HomeModel = require('./models/homeModel');

async function testHomeModel() {
    try {
        console.log('Testing HomeModel...');

        const featuredAnime = await HomeModel.getFeaturedAnime();
        console.log('Featured Anime:', featuredAnime);

        if (featuredAnime.length > 0) {
            console.log('✅ Test passed: Data was successfully scraped.');
        } else {
            console.log('❌ Test failed: No data was scraped.');
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);

        // Log the full error for debugging
        console.error('Full error:', error);
    }
}

// Run the test
// testHomeModel();

async function fetchProxies() {
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
            newProxies.forEach((proxy) => {if(validateProxy(proxy)){proxies.add(proxy)}});
        } catch (error) {
            console.error(`Failed to fetch proxies from ${source}:`, error.message);
        }
    }

    console.log('Fetched proxies:', Array.from(proxies));
    return Array.from(proxies);
}

fetchProxies();

async function validateProxy(proxy) {
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

// Example usage
validateProxy('http://50.171.122.28:80');

