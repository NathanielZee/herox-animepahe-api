const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const ApiClient = require('../scrapers/apiClient');

class HomeModel extends BaseScraper {
    static async getAiringAnime(page) {
        try {
            console.log('Attempting to scrape API data on page', page);
            const apiData = await ApiClient.getData("airing", { page });

            console.log("API DATA", apiData);
            
            if (apiData && (apiData.data)) {
                console.log('Successfully retrieved API data');
                return DataProcessor.processApiData(apiData);
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

    static async searchAnime(query, page) {
        try {
            console.log('Attempting to scrape API data on page', page);
            const apiData = await ApiClient.getData("search", { query, page });

            console.log("API DATA", apiData);
            
            if (apiData && (apiData.data)) {
                console.log('Successfully retrieved API data');
                return DataProcessor.processApiData(apiData, 'search');
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
    
    static async scrapeHomePage() {
        console.log('Scraping home page HTML');
        const url = Config.getUrl('home');
        const $ = await this.fetchPage(url);
        
        const airingAnime = [];
        $('.episode-list .episode-wrap').each((i, element) => {
            airingAnime.push({
                title: $(element).find('.episode .episode-title-warap a').text().trim(),
                episode: $(element).find('.episode .episode-number').text().trim(),
                image: $(element).find('.episode .episode-snapshot img').attr('src'),
                link: `${Config.baseUrl}${$(element).find('a').attr('href')}`
            });
        });
         
        console.log(`Scraped ${airingAnime.length} anime items from HTML`);

        if (airingAnime.length === 0) {
            console.log('No items found');

            return [];
        }
        
        return airingAnime;
    }
}

module.exports = HomeModel;