const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const ApiClient = require('../scrapers/apiClient');
const { CustomError } = require('../middleware/errorHandler');

class HomeModel extends BaseScraper {
    static async getAiringAnime(page) {
        const apiData = await ApiClient.getData("airing", { page });

        if (!apiData || !apiData.data) {
            const htmlData = await this.scrapeHomePage();
            if (!htmlData || htmlData.length === 0) {
                throw new CustomError('No airing anime data found', 404);
            }
            return htmlData;
        }

        return DataProcessor.processApiData(apiData);
    }

    static async searchAnime(query, page) {
        if (!query) {
            throw new CustomError('Search query is required', 400);
        }

        const apiData = await ApiClient.getData("search", { query, page });

        if (!apiData || !apiData.data) {
            throw new CustomError('No search results found', 404);
        }

        return DataProcessor.processApiData(apiData, 'search');
    }
    
    static async scrapeHomePage() {
        const url = Config.getUrl('home');
        const $ = await this.fetchPage(url);
        
        if (!$) {
            throw new CustomError('Failed to load home page', 503);
        }

        const airingAnime = [];
        $('.episode-list .episode-wrap').each((i, element) => {
            airingAnime.push({
                title: $(element).find('.episode .episode-title-warap a').text().trim(),
                episode: $(element).find('.episode .episode-number').text().trim(),
                image: $(element).find('.episode .episode-snapshot img').attr('src'),
                link: `${Config.baseUrl}${$(element).find('a').attr('href')}`
            });
        });
         
        return airingAnime;
    }
}

module.exports = HomeModel;