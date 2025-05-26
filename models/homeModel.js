const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const Animepahe = require('../scrapers/animepahe');
const { CustomError } = require('../middleware/errorHandler');

class HomeModel {
    static async getAiringAnime(page) {
        const results = await Animepahe.getData("airing", { page });

        if (!results || !results.data) {
            const htmlData = await this.scrapeHomePage();
            if (!htmlData || htmlData.length === 0) {
                throw new CustomError('No airing anime data found', 404);
            }
            return htmlData;
        }

        return DataProcessor.processApiData(results);
    }

    static async searchAnime(query, page) {
        if (!query) {
            throw new CustomError('Search query is required', 400);
        }

        const results = await Animepahe.getData("search", { query, page });

        if (!results || !results.data) {
            throw new CustomError('No search results found', 404);
        }

        return DataProcessor.processApiData(results, 'search');
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