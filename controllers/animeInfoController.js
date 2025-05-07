const AnimeInfoModel = require('../models/animeInfoModel');

class AnimeInfoController {
    static async getAnimeInfo(req, res) {
        try {
            const animeId = req.params.id;
            const animeInfo = await AnimeInfoModel.getAnimeInfo(animeId);
            if(!animeInfo) {
                throw new Error("No result returned from animeInfo");
            }
            res.json(animeInfo);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to scrape anime info' });
        }
    }
    static async getAnimeReleases(req, res) {
        try {
            const animeId = req.params.id;
            const sort = req.query.sort || 'episode_desc';
            const page = req.query.page || 1; 
            const animeReleases = await AnimeInfoModel.getAnimeReleases(animeId, sort, page);
            if(!animeReleases) {
                throw new Error("No result returned from animeReleases");
            }
            res.json(animeReleases);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to scrape anime releases' });
        }
    }
}

module.exports = AnimeInfoController;