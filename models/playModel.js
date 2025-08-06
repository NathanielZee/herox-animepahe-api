// models/playModel.js - FIXED: Only scrape AnimepaHe, return kwik iframe URLs
const cheerio = require('cheerio');
const DataProcessor = require('../utils/dataProcessor');
const Animepahe = require('../scrapers/animepahe');
const { getJsVariable } = require('../utils/jsParser');
const { CustomError } = require('../middleware/errorHandler');

class PlayModel {
    static async getStreamingLinks(id, episodeId) {
        console.log(`🎬 [BACKEND] Getting play page data for ${id}/${episodeId}`);
        
        // STEP 1: Scrape AnimepaHe play page ONLY (this works fine on Railway)
        const results = await Animepahe.getData("play", { id, episodeId }, false);
        
        if (!results) {
            throw new CustomError('Failed to fetch streaming data', 503);
        }

        // Handle API response if available
        if (results.data) {
            return DataProcessor.processApiData(results);
        }
        
        // STEP 2: Extract iframe URLs from play page HTML
        return this.extractIframeUrlsOnly(results);
    }

    static async extractIframeUrlsOnly(pageHtml) {
        console.log('🔄 [BACKEND] Extracting kwik iframe URLs from AnimepaHe play page...');
        
        // Get session and provider info
        const [session, provider] = ['session', 'provider'].map(v => getJsVariable(pageHtml, v) || null);

        if (!session || !provider) {
            throw new CustomError('Episode not found', 404);
        }

        const $ = cheerio.load(pageHtml);        
        
        const playInfo = {
            // Basic episode info
            ids: {
                animepahe_id: parseInt($('meta[name="id"]').attr('content'), 10) || null,
                mal_id: parseInt($('meta[name="anidb"]').attr('content'), 10) || null,
                anilist_id: parseInt($('meta[name="anilist"]').attr('content'), 10) || null,
                anime_planet_id: parseInt($('meta[name="anime-planet"]').attr('content'), 10) || null,
                ann_id: parseInt($('meta[name="ann"]').attr('content'), 10) || null,
                anilist: $('meta[name="anilist"]').attr('content') || null,
                anime_planet: $('meta[name="anime-planet"]').attr('content') || null,
                ann: $('meta[name="ann"]').attr('content') || null,
                kitsu: $('meta[name="kitsu"]').attr('content') || null,
                myanimelist: $('meta[name="myanimelist"]').attr('content') || null
            },
            session,
            provider,
            episode: $('.episode-menu #episodeMenu').text().trim().replace(/\D/g, ''),
            
            // MAIN CHANGE: Return kwik iframe URLs instead of trying to scrape them
            kwik_iframes: [],
            
            // Download links still work fine from server
            downloadLinks: []
        };

        try {
            // Extract kwik iframe URLs from resolution menu
            playInfo.kwik_iframes = await this.extractKwikIframeUrls($);
            console.log(`📊 [BACKEND] Extracted ${playInfo.kwik_iframes.length} kwik iframe URLs`);
            
            if (playInfo.kwik_iframes.length === 0) {
                throw new CustomError('No streaming resolutions found', 404);
            }
            
            // Extract download links (this works fine from server)
            playInfo.downloadLinks = await this.getDownloadLinkList($);
            console.log(`📥 [BACKEND] Extracted ${playInfo.downloadLinks.length} download links`);
            
        } catch (error) {
            console.error('❌ [BACKEND] Error extracting iframe URLs:', error.message);
            throw new CustomError(`Failed to extract streaming data: ${error.message}`, 500);
        }

        console.log(`🎉 [BACKEND] Play page processing completed! Ready for frontend`);
        return playInfo;
    }

    // CHANGED: Extract iframe URLs only, don't try to access them
    static async extractKwikIframeUrls($) {
        const iframes = [];
        
        $('#resolutionMenu button').each((index, element) => {
            const iframe_url = $(element).attr('data-src');
            const resolution = $(element).attr('data-resolution');
            const audio = $(element).attr('data-audio');
            
            if (iframe_url) {
                iframes.push({
                    iframe_url: iframe_url, // This is what frontend will process
                    resolution: resolution || null,
                    isDub: (audio && audio.toLowerCase() === 'eng') || false,
                    fanSub: $(element).attr('data-fansub') || null,
                });
                
                console.log(`📋 [BACKEND] Found ${resolution}p iframe: ${iframe_url.substring(0, 50)}...`);
            }
        });

        return iframes;
    }

    // This still works fine on server (AnimepaHe download links)
    static async getDownloadLinkList($) {
        const downloadLinks = [];
        
        $('#pickDownload a').each((index, element) => {
            const link = $(element).attr('href');
            if (link) {
                const fullText = $(element).text().trim();
                const match = fullText.match(/(?:(\w+)\s*·\s*(\d+p)\s*\((\d+(?:\.\d+)?(?:MB|GB))\))(?:\s*(eng))?/i);
                
                downloadLinks.push({
                    url: link || null,
                    fansub: match ? match[1] : null,
                    quality: match ? match[2] : fullText,
                    filesize: match ? match[3] : null,
                    isDub: match && match[4] ? true : false
                });
            }
        });

        return downloadLinks;
    }
}

module.exports = PlayModel;
