const HomeModel = require('../models/homeModel');

class HomeController {
    static async getAiringAnime(req, res) {
        try {
            const page = req.query.page || 1;
            const airingAnime = await HomeModel.getAiringAnime(page);
            res.json(airingAnime);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to scrape homepage' });
        }
    }

    static async searchAnime(req, res) {
        try {
            const query = req.query.q;
            // PAGE HAS NO EFFECT ATM, JUST THERE INCASE
            const page = req.query.page || 1;
            const airingAnime = await HomeModel.searchAnime(query, page);
            res.json(airingAnime);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to scrape homepage' });
        }
    }
}

module.exports = HomeController;