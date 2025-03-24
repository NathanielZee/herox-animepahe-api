const AnimeInfoModel = require('../models/animeInfoModel');

class AnimeInfoController {
    static async getAnimeInfo(req, res) {
        try {
            const animeId = req.params.id;
            const animeInfo = await AnimeInfoModel.getAnimeInfo(animeId);
            res.json(animeInfo);
        } catch (error) {
            res.status(500).json({ error: 'Failed to scrape anime info' });
        }
    }
}

module.exports = AnimeInfoController;