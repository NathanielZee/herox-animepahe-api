const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const ApiClient = require('../scrapers/apiClient');

class playModel extends BaseScraper {
    static async getStreamingLinks(episodeId) {
        try {
            const apiData = await ApiClient.getData("play", { episodeId }, false);

            console.log("API DATA", apiData);

            if(apiData && typeof apiData === 'object' && !apiData.data) {
                console.log("API data is empty");

                apiData.data = [];
            }    
            
            if (apiData?.data) {
                return DataProcessor.processApiData(apiData);
            } else {
                console.log('Data doesn\'t seem like an Api, HTML scraping instead', apiData);
                return this.scrapePlayPage(apiData);
            }
        } catch (error) {
            console.log(error);
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
        }
    }
    static async scrapePlayPage(pageHtml) {
        console.log('Sounds like a drag to implement this now. But I guess I have no choice... \n Will try parsing', pageHtml);

        const html = cheerio.load(pageHtml);

        const $ = html;

        console.log("Successfullt fetched page", pageHtml);

        const iframe = {
            src: $('iframe').attr('src'),
            width: $('iframe').attr('width'),
            height: $('iframe').attr('height')
        }

        console.log("Iframe", iframe);

        return iframe;
    }
}

module.exports = playModel;