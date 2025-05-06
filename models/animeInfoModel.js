const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const ApiClient = require('../scrapers/apiClient');
const Config = require('../utils/config');

class AnimeInfoModel extends BaseScraper {
    static async getAnimeInfo(animeId) {
        try {
            console.log('Attempting to fetch API data for anime with Id', animeId);
            const apiData = await ApiClient.getData("animeInfo", { animeId }, false);
            
            if (apiData && (apiData.data)) {
                console.log('Successfully retrieved API data');
                return DataProcessor.processApiData(apiData);
            } else {
                console.log('API data not in expected format, falling back to HTML scraping');
                return this.scrapeInfoPage(apiData);
            }
        } catch (error) {
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
            // return this.scrapeInfoPage(animeId, 'default');
        }
    }
    static async getAnimeReleases(animeId, sort, page) {
        try {
            console.log('Attempting to scrape API data on page', page);
            
            const apiData = await ApiClient.getData("releases", { animeId, sort, page });

            console.log("API DATA", apiData);

            if(apiData && typeof apiData === 'object' && !apiData.data) {
                console.log("API data is empty");
    
                apiData.data = [];
            }    
            
            if (apiData) {
                apiData.data.map(item => item._id = animeId);
                console.log('Successfully retrieved API data', apiData);
                return DataProcessor.processApiData(apiData, "releases");
            } else {
                console.log('API data not in expected format, falling back to HTML scraping');
                // return this.scrapeInfoPage();
            }
        } catch (error) {
            console.log(error);
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
            // return this.scrapeInfoPage();
        }
    }
    static async scrapeInfoPage(html) {
        console.log('Sounds like a drag to implement this now. But I guess I have no choice... \n Will try parsing', html);
        // const url = Config.getUrl('animeInfo', animeId);

        // console.log("Attempting to fetch url", url);

        // const $ = await this.fetchPage(url, type);

        const $ = html;

        console.log("Successfully fetched page", $);

        const animeInfo = {
            ids: {
                // Main internal ID
                animepahe_id: $('meta[name="id"]').attr('content') || null,
            
                // External service IDs
                anidb: $('meta[name="anidb"]').attr('content') || null,
                anilist: $('meta[name="anilist"]').attr('content') || null,
                animePlanet: $('meta[name="anime-planet"]').attr('content') || null,
                ann: $('meta[name="ann"]').attr('content') || null,
                kitsu: $('meta[name="kitsu"]').attr('content') || null,
                mal: $('meta[name="myanimelist"]').attr('content') || null
            },
            title: $('.title-wrapper h1 span').first().text().trim(),

            image: $('.poster-wrapper .anime-poster img').attr('data-src'),

            synopsis: $('.content-wrapper .anime-synopsis').text().trim(),

            synonym: $('.anime-info p:contains("Synonyms:")').text().split('Synonyms:')[1].trim(),

            japanese: $('.anime-info p:contains("Japanese:")').text().split('Japanese:')[1].trim(),
          
            type: $('.anime-info p:contains("Type:") a').text().trim(),
          
            episodes: $('.anime-info p:contains("Episodes:")').text().replace('Episodes:', "").trim(),

            status: $('.anime-info p:contains("Status:") a').text().trim(),
          
            duration: $('.anime-info p:contains("Duration:")').text().split('Duration:')[1].trim(),
          
            aired: ($('.anime-info p:contains("Aired:")').text().split('Aired:')[1] || '')
            .replace(/\s+/g, ' ')
            .replace(/to\s+\?/, '')
            .trim()
            .replace(/(\w{3} \d{2}, \d{4}) +to +(\w{3} \d{2}, \d{4})/, '$1 to $2'),

            season: $('.anime-info p:contains("Season:") a').text().trim(),
          
            studio: $('.anime-info p:contains("Studio:")').text().split('Studio:')[1].trim(),
          
            themes: $('.anime-info p:contains("Themes:")')
            .find('a')
            .map((i, el) => $(el).text().trim())
            .get() || [],

            demographic: $('.anime-info p:contains("Demographic:")')
            .find('a')
            .map((i, el) => $(el).text().trim())
            .get() || [],
          
            external_links: $('.anime-info p.external-links a').map((i, el) => ({
              name: $(el).text(),
              url: $(el).attr('href').replace(/^(http:)?\/\//, 'https://').replace(/^https:\/\/https:\/\//, 'https://')
            })).get(),

            genre: $('.anime-info div.anime-genre ul li a').map((i, el) => ({
                name: $(el).text(),
                url: Config.baseUrl 
                + $(el).attr('href')
              })).get() || []
        };

        console.log(animeInfo);

        return animeInfo;
    }
}

module.exports = AnimeInfoModel;