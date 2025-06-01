const PlayModel = require('../models/playModel');
class PlayController {
    static async getStreamingLinks(req, res) {
        try {
            const { episodeId } = req.params;
            const links = await PlayModel.getStreamingLinks();
            res.json(links);
        } catch (error) {
            res.status(500).json({ error: 'Failed to scrape play' });
        }
    }
}

module.exports = PlayController;