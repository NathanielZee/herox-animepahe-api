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
            title: $('.title-wrapper h1 span').first().text().trim(),
            image: $('.poster-wrapper .anime-poster img').attr('data-src'),
            synopsis: $('.content-wrapper .anime-synopsis').text().trim(),
            // genres: [],
            // episodes: [],
            // releases: []
        };

        console.log(animeInfo);

        return animeInfo;
    }
}

module.exports = AnimeInfoModel;