const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const Animepahe = require('../scrapers/animepahe');
const { CustomError } = require('../middleware/errorHandler');

class QueueModel {
    static async getQueue() {
        const apiData = await Animepahe.getData("queue");

        if (!apiData) {
            throw new CustomError('Failed to fetch queue data', 503);
        }

        if (typeof apiData === 'object' && !apiData.data) {
            apiData.data = [];
        }

        return DataProcessor.processApiData(apiData, "queue");
    }
}

module.exports = QueueModel;