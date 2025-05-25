const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const ApiClient = require('../scrapers/apiClient');
const { CustomError } = require('../middleware/errorHandler');

class QueueModel extends BaseScraper {
    static async getQueue() {
        const apiData = await ApiClient.getData("queue");

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