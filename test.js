const axios = require('axios');
const HomeModel = require('./models/homeModel');

(async () => {
  try {
    const response = await axios.get('https://kwik.si/e/20mY5NRELd7H', {
      headers: {
        'Referer': 'https://animepahe.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    const data = response.data;

    let sources = [];

    const execResult = /(eval)(\(f.*?)(\n<\/script>)/s.exec(data);
    const source = execResult ? eval(execResult[2].replace('eval', '')).match(
        /https.*?m3u8/
    ) : null;

    sources.push({
        url: source[0],
        isM3U8: source[0].includes('.m3u8'),
    });

    console.log(sources)

    return sources;

  } catch (error) {
    console.error('Error fetching the page:', error.message);
  }
})();


async function testHomeModel() {
    try {
        console.log('Testing HomeModel...');

        const airingAnime = await HomeModel.getAiringAnime();
        console.log('Featured Anime:', airingAnime);

        if (airingAnime.length > 0) {
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
            // console.error(`Failed to fetch proxies from ${source}:`, error.message);
        }
    }

    // console.log('Fetched proxies:', Array.from(proxies));
    return Array.from(proxies);
}

// fetchProxies();

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
        // console.error(`Proxy ${proxy} failed:`, error.message);
        return false;
    }
}

// Example usage
validateProxy('http://50.171.122.28:80');

async function fetchAnimeData() {
    const url = 'https://animepahe.ru/anime/9a16dfb8-8ffc-a0b0-6508-1b291afa04a7';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://animepahe.ru/',
        'Origin': 'https://animepahe.ru/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': '__ddg2_=AoyqRUsdaxJxe5aK; __ddgid_=ql3tWKTMRULVcCeC;'
    };

    try {
        const response = await axios.get(url, { headers });
        console.log('Anime Data:', response.data);
    } catch (error) {
        console.error('❌ Failed to fetch anime data:', error.message);
        // Log the full error for debugging
        console.error('Full error:', error);
    }
}

// Run the function
// fetchAnimeData();
