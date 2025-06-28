const AnimeListModel = require('../models/animeListModel');
const { CustomError } = require('../middleware/errorHandler');

class AnimeListController {
    static async getAllAnime(req, res, next) {
        try {
            const { tab } = req.query;
            const animeList = await AnimeListModel.getAnimeList(tab);

            if (!animeList) {
                throw new CustomError('Failed to fetch anime list', 404);
            }

            return res.json(animeList);
        } catch (error) {
            next(error);
        }
    }

    static async getAnimeByTags(req, res, next) {
        try {
            const { tab } = req.query;
            const { tag1, tag2 } = req.params;

            if (!tag1 && !tag2) {
                throw new CustomError('At least one tag is required', 400);
            }

            const animeList = await AnimeListModel.getAnimeList(tab, tag1, tag2);

            if (!animeList) {
                throw new CustomError('No anime found with these tags', 404);
            }

            return res.json(animeList);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AnimeListController;