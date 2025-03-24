const BaseScraper = require('../scrapers/baseScraper');
const Config = require('../utils/config');

class QueueModel {
    static async getQueue() {
        const url = Config.getUrl('queue'); // Get the queue URL
        const $ = await BaseScraper.fetchPage(url);
        const queue = [];
        $('.queue-item').each((i, element) => {
            queue.push({
                title: $(element).find('.title').text(),
                episode: $(element).find('.episode').text(),
                status: $(element).find('.status').text(),
            });
        });
        return queue;
    }
}

module.exports = QueueModel;