const AnimeListModel = require('../models/animeListModel');

class AnimeListController {
    static async getAllAnime(req, res) {
        try {
            const { tab } = req.query;

            const animeList = await AnimeListModel.getAnimeList(tab);

            return res.json(animeList);

        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to scrape AnimeList' });
        }
    }

    static async getAnimeByTags(req, res) {
        try {
            const { tab } = req.query;
            const { tag1, tag2 } = req.params;

            const animeList = await AnimeListModel.getAnimeList(tab, tag1, tag2);

            return res.json(animeList);

        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to scrape Anime by Genre' });
        }
    }
}

module.exports = AnimeListController;