const QueueModel = require('../models/queueModel');

class QueueController {
    static async getQueue(req, res) {
        try {
            const queue = await QueueModel.getQueue();
            res.json(queue);
        } catch (error) {
            res.status(500).json({ error: 'Failed to scrape queue' });
        }
    }
}

module.exports = QueueController;