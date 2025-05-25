const cheerio = require('cheerio');
const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const Config = require('../utils/config');
const Animepahe = require('../scrapers/animepahe');
const { getJsVariable } = require('../utils/jsParser');
const { CustomError } = require('../middleware/errorHandler');

class PlayModel extends BaseScraper {
    static async getStreamingLinks(id, episodeId) {
        const apiData = await Animepahe.getData("play", { id, episodeId }, false);
        
        if (!apiData) {
            throw new CustomError('Failed to fetch streaming data', 503);
        }

        if (typeof apiData === 'object' && !apiData.data) {
            apiData.data = [];
        }    
        
        if (apiData.data) {
            return DataProcessor.processApiData(apiData);
        }
        
        return this.scrapePlayPage(apiData);
    }

    static async scrapeIframe(url) {
        const data = await Animepahe.getData("iframe", { url }, false);
        if (!data) {
            throw new CustomError('Failed to fetch iframe data', 503);
        }

        const execResult = /(eval)(\(f.*?)(\n<\/script>)/s.exec(data);
        if (!execResult) {
            throw new CustomError('Failed to extract source from iframe', 500);
        }

        const source = eval(execResult[2].replace('eval', '')).match(/https.*?m3u8/);
        if (!source) {
            throw new CustomError('Failed to extract m3u8 URL', 500);
        }

        return [{
            url: source[0],
            isM3U8: source[0].includes('.m3u8'),
        }];
    }     
    
    static async scrapePlayPage(pageHtml) {
        const [ session, provider, url ] = ['session', 'provider', 'url'].map(v => getJsVariable(pageHtml, v) || null);

        if (!session || !provider || !url) {
            throw new CustomError('Episode not found', 404);
        }

        const $ = cheerio.load(pageHtml);        
        
        const playInfo = {
            ids: {
                animepahe_id: parseInt($('meta[name="id"]').attr('content')) || null,
                mal_id: parseInt($('meta[name="anidb"]').attr('content')) || null,
                anilist_id: parseInt($('meta[name="anilist"]').attr('content')) || null,
                anime_planet_id: parseInt($('meta[name="anime-planet"]').attr('content')) || null,
                ann_id: parseInt($('meta[name="ann"]').attr('content')) || null,
                anilist: $('meta[name="anilist"]').attr('content') || null,
                anime_planet: $('meta[name="anime-planet"]').attr('content') || null,
                ann: $('meta[name="ann"]').attr('content') || null,
                kitsu: $('meta[name="kitsu"]').attr('content') || null,
                myanimelist: $('meta[name="myanimelist"]').attr('content') || null
            },
            session,
            provider,
            url,
            episode: $('.episode-menu #episodeMenu').text().trim().replace(/\D/g, ''),
        };

        try {
            playInfo.m3u8 = await this.scrapeIframe(url);
        } catch (error) {
            playInfo.m3u8 = null;
        }

        return playInfo;
    }
}

module.exports = PlayModel;