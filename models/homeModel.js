const BaseScraper = require('../scrapers/baseScraper');
const ApiScraper = require('../scrapers/apiScraper');
const Config = require('../utils/config');

class HomeModel extends BaseScraper {
    static async getFeaturedAnime(page) {
        try {
            // First try to scrape the API endpoint
            console.log('Attempting to scrape API data');
            const apiData = await ApiScraper.fetchApiData(`api?m=airing&page=${page}`);

            console.log("API DATA", apiData);
            
            if (apiData && (apiData.data)) {
                console.log('Successfully retrieved API data');
                return this.processApiData(apiData);
            } else {
                console.log('API data not in expected format, falling back to HTML scraping');
                return this.scrapeHomePage();
            }
        } catch (error) {
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
            return this.scrapeHomePage();
        }
    }
    
    static processApiData(apiData) {
        console.log('Processing API data');

        const items = apiData.data || [];
        
        if (!Array.isArray(items)) {
            console.error('Unexpected API response format:', JSON.stringify(apiData).substring(0, 200));
            throw new Error('Unexpected API response format');
        }
        
        const paginationInfo = {
            total: apiData.total || null,
            perPage: apiData.per_page || null,
            currentPage: apiData.current_page || null,
            lastPage: apiData.last_page || null,
            nextPageUrl: apiData.next_page_url || null,
            prevPageUrl: apiData.prev_page_url || null,
            from: apiData.from || null,
            to: apiData.to || null,
        };

        const featuredAnime = items.map(item => ({
            id: item.id || null, 
            anime_id: item.anime_id || null,
            title: item.anime_title || null,
            episode: item.episode || null,
            episode2: item.episode2 || null,
            edition: item.edition || null,
            fansub: item.fansub || null,
            image: item.snapshot ||null,
            disc: item.disc || null,
            session: item.session || null,
            link: (item.session ? `${Config.getUrl('animeInfo', item.session)}` : '') || null,
            filler: item.filler || null, 
            created_at: item.created_at || null,
            completed: item.completed || 1
        }));
        
        console.log("Featured Anime:", featuredAnime);

        console.log(`Processed ${featuredAnime.length} anime items from API`);
        return { paginationInfo, data: featuredAnime };
    }
    
    static async scrapeHomePage() {
        console.log('Scraping home page HTML');
        const url = Config.getUrl('home');
        const $ = await this.fetchPage(url);
        
        const featuredAnime = [];
        $('.episode-list .episode-wrap').each((i, element) => {
            featuredAnime.push({
                title: $(element).find('.episode .episode-title-warap a').text().trim(),
                episodeNumber: $(element).find('.episode .episode-number').text().trim(),
                image: $(element).find('.episode .episode-snapshot img').attr('src'),
                link: $(element).find('a').attr('href')
            });
        });
         
        console.log(`Scraped ${featuredAnime.length} anime items from HTML`);

        if (featuredAnime.length === 0) {
            console.log('No items found');

            return [];
        }
        
        return featuredAnime;
    }
}

module.exports = HomeModel;