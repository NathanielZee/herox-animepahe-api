const cheerio = require('cheerio');
const DataProcessor = require('../utils/dataProcessor');
const Animepahe = require('../scrapers/animepahe');
const { getJsVariable } = require('../utils/jsParser');
const { CustomError } = require('../middleware/errorHandler');

class PlayModel {
    static async getStreamingLinks(id, episodeId) {
        const results = await Animepahe.getData("play", { id, episodeId }, false);
        
        if (!results) {
            throw new CustomError('Failed to fetch streaming data', 503);
        }

        if (typeof results === 'object' && !results.data) {
            results.data = [];
        }    
        
        if (results.data) {
            return DataProcessor.processApiData(results);
        }

        console.log(results);
        
        return this.scrapePlayPage(results);
    }

    static async getDownloadLinks($) {
        const downloadLinks = [];
        
        $('#pickDownload a').each((index, element) => {
            const link = $(element).attr('href');
            if (link) {
                downloadLinks.push({
                    url: link || null,
                    quality: $(element).text().trim() || null,
                });
            }
        });

        if (downloadLinks.length === 0) {
            throw new CustomError('No download links found', 404);
        }

        return downloadLinks;
    }

    static async scrapeIframe(url) {
        const results = await Animepahe.getData("iframe", { url }, false);
        console.log("Iframe data:", results);
        if (!results) {
            throw new CustomError('Failed to fetch iframe data', 503);
        }

        const execResult = /(eval)(\(f.*?)(\n<\/script>)/s.exec(results);
        if (!execResult) {
            throw new CustomError('Failed to extract source from iframe', 500);
        }

        const source = eval(execResult[2].replace('eval', '')).match(/https.*?m3u8/);
        if (!source) {
            throw new CustomError('Failed to extract m3u8 URL', 500);
        }

        return [{
            url: source[0] || null,
            isM3U8: source[0].includes('.m3u8') || null,
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
            playInfo.sources = await this.scrapeIframe(url);
            playInfo.downloadLinks = await this.getDownloadLinks($);
        } catch (error) {
            console.error(error);
            playInfo.m3u8 = null;
        }

        return playInfo;
    }
}

module.exports = PlayModel;