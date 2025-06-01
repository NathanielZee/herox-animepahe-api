const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const Animepahe = require('../scrapers/animepahe');
const { CustomError } = require('../middleware/errorHandler');

class QueueModel {
    static async getQueue() {
        const results = await Animepahe.getData("queue");

        if (!results) {
            throw new CustomError('Failed to fetch queue data', 503);
        }

        if (typeof results === 'object' && !results.data) {
            results.data = [];
        }

        return DataProcessor.processApiData(results, "queue", false);
    }
}

module.exports = QueueModel;