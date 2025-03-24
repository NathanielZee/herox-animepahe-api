const BaseScraper = require('../scrapers/baseScraper');
const Config = require('../utils/config');

class AnimeInfoModel {
    static async getAnimeInfo(animeId) {
        const url = Config.getUrl('animeInfo', animeId); // Get the anime info URL
        const $ = await BaseScraper.fetchPage(url);
        return {
            title: $('.anime-title').text(),
            description: $('.anime-description').text(),
            rating: $('.anime-rating').text(),
            episodes: $('.anime-episodes').text(),
        };
    }
}

module.exports = AnimeInfoModel;