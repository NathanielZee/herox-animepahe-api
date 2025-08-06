// models/playModel.js - HYBRID VERSION (Server-side for AnimepaHe + Client-side for kwik.si)
const cheerio = require('cheerio');
const DataProcessor = require('../utils/dataProcessor');
const Animepahe = require('../scrapers/animepahe');
const { getJsVariable } = require('../utils/jsParser');
const { launchBrowser } = require('../utils/browser');
const { CustomError } = require('../middleware/errorHandler');

class PlayModel {
    static async getStreamingLinks(id, episodeId) {
        console.log(`🎬 [HYBRID] Getting streaming links for ${id}/${episodeId}`);
        
        // STEP 1: Use server-side to get AnimepaHe play page (this works fine)
        console.log('🌐 [SERVER-SIDE] Fetching AnimepaHe play page...');
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
        
        // STEP 2: Server-side scraping of AnimepaHe play page
        console.log('✅ [SERVER-SIDE] AnimepaHe play page fetched successfully');
        return this.scrapePlayPageHybrid(results);
    }

    static async scrapePlayPageHybrid(pageHtml) {
        console.log('🔄 [HYBRID] Starting hybrid scraping (server + client)...');
        
        // STEP 1: Server-side extraction of play page data (works fine)
        const [ session, provider ] = ['session', 'provider'].map(v => getJsVariable(pageHtml, v) || null);

        if (!session || !provider) {
            throw new CustomError('Episode not found', 404);
        }

        const $ = cheerio.load(pageHtml);        
        
        const playInfo = {
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
        };

        try {
            // STEP 2: Server-side extraction of resolution URLs (works fine)
            const resolutions = await this.getResolutionList($);
            console.log(`📊 [SERVER-SIDE] Extracted ${resolutions.length} resolution URLs`);
            
            if (resolutions.length === 0) {
                throw new CustomError('No streaming resolutions found', 404);
            }
            
            // STEP 3: Client-side scraping of kwik.si iframes (bypasses Cloudflare)
            console.log('🌐 [CLIENT-SIDE] Processing kwik.si iframes with browser automation...');
            const allSources = await this.scrapeIframesWithBrowser(resolutions);
            playInfo.sources = allSources;

            // STEP 4: Server-side extraction of download links (works fine)
            playInfo.downloadLinks = await this.getDownloadLinkList($);
            console.log(`📥 [SERVER-SIDE] Extracted ${playInfo.downloadLinks.length} download links`);
            
        } catch (error) {
            console.error('❌ [HYBRID] Error in hybrid scraping:', error.message);
            throw new CustomError(`Hybrid scraping failed: ${error.message}`, 500);
        }

        console.log(`🎉 [HYBRID] Hybrid scraping completed! ${playInfo.sources.length} sources extracted`);
        return playInfo;
    }

    // CLIENT-SIDE: Browser automation for kwik.si iframes ONLY
    static async scrapeIframesWithBrowser(resolutions) {
        console.log('🚀 [CLIENT-SIDE] Starting browser for iframe scraping...');
        
        let browser = null;
        let context = null;
        let page = null;
        const sources = [];

        try {
            browser = await launchBrowser();
            
            // Stealth browser context
            context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1366, height: 768 },
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            });
            
            page = await context.newPage();

            // Anti-detection scripts
            await page.addInitScript(() => {
                delete navigator.__proto__.webdriver;
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', length: 1 },
                        { name: 'Chrome PDF Viewer', length: 1 }
                    ],
                });
                window.chrome = { runtime: {} };
            });

            console.log(`🎯 [CLIENT-SIDE] Processing ${resolutions.length} kwik.si iframes...`);

            // Process each iframe with browser
            for (let i = 0; i < resolutions.length; i++) {
                const resData = resolutions[i];
                try {
                    console.log(`🔍 [CLIENT-SIDE] Processing ${resData.resolution}p iframe (${i + 1}/${resolutions.length})`);
                    
                    // Human-like delay
                    if (i > 0) {
                        const delay = 1500 + Math.random() * 2000;
                        await page.waitForTimeout(delay);
                    }
                    
                    console.log(`📍 [CLIENT-SIDE] Navigating to: ${resData.url}`);
                    
                    const response = await page.goto(resData.url, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 25000 
                    });

                    console.log(`📊 [CLIENT-SIDE] Response status: ${response.status()}`);
                    
                    // Even if we get 403, check if content loaded
                    await page.waitForTimeout(3000);
                    
                    const iframeHtml = await page.content();
                    
                    // Check for actual blocking
                    if (iframeHtml.includes('DDoS-Guard') || 
                        iframeHtml.includes('checking your browser') ||
                        iframeHtml.includes('Attention Required! | Cloudflare')) {
                        console.log(`❌ [CLIENT-SIDE] ${resData.resolution}p blocked by protection`);
                        continue;
                    }
                    
                    console.log(`🔓 [CLIENT-SIDE] ${resData.resolution}p content accessible (${iframeHtml.length} chars)`);
                    
                    // Extract the eval code (same as server-side logic)
                    const evalMatch = iframeHtml.match(/(eval)(\(f.*?)(\n<\/script>)/s);
                    if (evalMatch) {
                        console.log(`🔍 [CLIENT-SIDE] Found eval code for ${resData.resolution}p`);
                        
                        const sourceCode = evalMatch[2].replace('eval', '');
                        
                        try {
                            const decodedContent = await page.evaluate((code) => {
                                return eval(code);
                            }, sourceCode);
                            
                            const m3u8Match = decodedContent.match(/https.*?m3u8/);
                            if (m3u8Match) {
                                sources.push({
                                    url: m3u8Match[0],
                                    isM3U8: true,
                                    resolution: resData.resolution,
                                    isDub: resData.isDub,
                                    fanSub: resData.fanSub
                                });
                                console.log(`✅ [CLIENT-SIDE] Extracted ${resData.resolution}p m3u8: ${m3u8Match[0].substring(0, 50)}...`);
                            } else {
                                console.log(`⚠️ [CLIENT-SIDE] No m3u8 found in ${resData.resolution}p decoded content`);
                                console.log(`📄 [CLIENT-SIDE] Decoded preview:`, decodedContent.substring(0, 200));
                            }
                        } catch (evalError) {
                            console.log(`❌ [CLIENT-SIDE] Eval failed for ${resData.resolution}p:`, evalError.message);
                        }
                    } else {
                        console.log(`⚠️ [CLIENT-SIDE] No eval code found for ${resData.resolution}p`);
                        console.log(`📄 [CLIENT-SIDE] Content preview:`, iframeHtml.substring(0, 300));
                    }
                    
                } catch (error) {
                    console.error(`❌ [CLIENT-SIDE] Failed processing ${resData.resolution}p:`, error.message);
                }
            }

            console.log(`🎉 [CLIENT-SIDE] Browser iframe scraping completed: ${sources.length}/${resolutions.length} successful`);
            
        } catch (error) {
            console.error('❌ [CLIENT-SIDE] Browser iframe scraping failed:', error.message);
            throw new CustomError(`Browser iframe scraping failed: ${error.message}`, 503);
        } finally {
            try {
                if (page) await page.close();
                if (context) await context.close();
                if (browser) await browser.close();
                console.log('🔧 [CLIENT-SIDE] Browser cleanup completed');
            } catch (cleanupError) {
                console.error('⚠️ [CLIENT-SIDE] Browser cleanup error:', cleanupError.message);
            }
        }

        if (sources.length === 0) {
            throw new CustomError('No streaming sources could be extracted from kwik.si iframes', 404);
        }

        return sources;
    }

    // SERVER-SIDE: These methods work fine with AnimepaHe
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

    static async getResolutionList($) {
        const resolutions = [];
        
        $('#resolutionMenu button').each((index, element) => {
            const link = $(element).attr('data-src');
            const resolution = $(element).attr('data-resolution');
            const audio = $(element).attr('data-audio');
            if (link) {
                resolutions.push({
                    url: link || null,
                    resolution: resolution || null,
                    isDub: (audio && audio.toLowerCase() === 'eng') || false,
                    fanSub: $(element).attr('data-fansub') || null,
                });
            }
        });

        return resolutions;
    }
}

module.exports = PlayModel;
