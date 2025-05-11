const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const ApiClient = require('../scrapers/apiClient');

class QueueModel extends BaseScraper {
    static async getQueue() {
        try {
            const apiData = await ApiClient.getData("queue");

            console.log("API DATA", apiData);

            if(apiData && typeof apiData === 'object' && !apiData.data) {
                console.log("API data is empty, probably cause there's nothing to encode");

                apiData.data = [];
            }    
            
            if (apiData) {
                apiData.data.map(item => item._id = animeId);
                console.log('Successfully retrieved API data', apiData);
                return DataProcessor.processApiData(apiData, "queue");
            } else {
                console.log('API data not in expected format, falling back to HTML scraping');
                // return this.scrapeQueuePage();
            }
        } catch (error) {
            console.log(error);
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
        }
    }
}

module.exports = QueueModel;