const QueueModel = require('../models/queueModel');
const { CustomError } = require('../middleware/errorHandler');

class QueueController {
    static async getQueue(req, res, next) {
        try {
            const queue = await QueueModel.getQueue();
            
            if (!queue) {
                throw new CustomError('Failed to fetch queue data', 404);
            }

            return res.json(queue);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = QueueController;