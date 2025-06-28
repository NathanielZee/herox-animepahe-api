const PlayModel = require('../models/playModel');
const { CustomError } = require('../middleware/errorHandler');

class PlayController {
    static async getStreamingLinks(req, res, next) {
        try {
            const { id } = req.params;
            const { episodeId } = req.query;

            if (!id || !episodeId) {
                throw new CustomError('Both id and episodeId are required', 400);
            }

            const links = await PlayModel.getStreamingLinks(id, episodeId);
            return res.json(links);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = PlayController;