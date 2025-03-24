const HomeModel = require('../models/homeModel');

class HomeController {
    static async getFeaturedAnime(req, res) {
        try {
            const page = req.query.page || 1;
            const featuredAnime = await HomeModel.getFeaturedAnime(page);
            res.json(featuredAnime);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to scrape homepage' });
        }
    }
}

module.exports = HomeController;