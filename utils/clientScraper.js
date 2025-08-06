// utils/clientScraper.js - Improved version with better debugging and error handling
const { launchBrowser } = require('./browser');
const { CustomError } = require('../middleware/errorHandler');

class ClientScraper {
    static async scrapePlayPage(animeId, episodeId) {
        console.log('🌐 [CLIENT-SIDE] Starting browser-based play page scraping...');
        console.log(`📍 [CLIENT-SIDE] Target: animepahe.ru/play/${animeId}/${episodeId}`);
        
        let browser = null;
        let context = null;
        let page = null;

        try {
            browser = await launchBrowser();
            
            context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1366, height: 768 },
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br'
                }
            });
            
            page = await context.newPage();

            // Navigate to the animepahe play page
            const playUrl = `https://animepahe.ru/play/${animeId}/${episodeId}`;
            console.log('📺 [CLIENT-SIDE] Loading play page:', playUrl);
            
            const response = await page.goto(playUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            if (!response.ok()) {
                throw new Error(`Failed to load play page: ${response.status()} ${response.statusText()}`);
            }

            console.log('✅ [CLIENT-SIDE] Play page loaded successfully');

            // Wait a bit for the page to fully load
            await page.waitForTimeout(3000);

            // Check if the page loaded correctly by looking for expected elements
            const hasResolutionMenu = await page.$('#resolutionMenu') !== null;
            const hasEpisodeMenu = await page.$('#episodeMenu') !== null;
            
            console.log('🔍 [CLIENT-SIDE] Page validation:', { hasResolutionMenu, hasEpisodeMenu });
            
            if (!hasResolutionMenu) {
                console.log('❌ [CLIENT-SIDE] Resolution menu not found - page might not have loaded correctly');
                const pageTitle = await page.title();
                const pageContent = await page.content();
                console.log('📄 [CLIENT-SIDE] Page title:', pageTitle);
                console.log('📄 [CLIENT-SIDE] Page content preview:', pageContent.substring(0, 500));
                
                // Check if we got a "not found" or error page
                if (pageContent.includes('404') || pageContent.includes('Not Found') || pageContent.includes('Episode not found')) {
                    throw new Error('Episode not found or invalid anime/episode ID');
                }
            }

            // Extract episode information with better error handling
            const episodeData = await page.evaluate(() => {
                console.log('🔍 [BROWSER] Starting data extraction...');
                
                // Extract IDs from meta tags
                const ids = {
                    animepahe_id: parseInt(document.querySelector('meta[name="id"]')?.content, 10) || null,
                    mal_id: parseInt(document.querySelector('meta[name="anidb"]')?.content, 10) || null,
                    anilist_id: parseInt(document.querySelector('meta[name="anilist"]')?.content, 10) || null,
                    anime_planet_id: parseInt(document.querySelector('meta[name="anime-planet"]')?.content, 10) || null,
                    ann_id: parseInt(document.querySelector('meta[name="ann"]')?.content, 10) || null,
                    anilist: document.querySelector('meta[name="anilist"]')?.content || null,
                    anime_planet: document.querySelector('meta[name="anime-planet"]')?.content || null,
                    ann: document.querySelector('meta[name="ann"]')?.content || null,
                    kitsu: document.querySelector('meta[name="kitsu"]')?.content || null,
                    myanimelist: document.querySelector('meta[name="myanimelist"]')?.content || null
                };

                // Extract session and provider from JavaScript variables
                const scripts = Array.from(document.scripts).map(s => s.textContent).join('\n');
                console.log('🔍 [BROWSER] Searching for session/provider in scripts...');
                
                const sessionMatch = scripts.match(/(?:let|var|const)\s+session\s*=\s*["']([^"']+)["']/);
                const providerMatch = scripts.match(/(?:let|var|const)\s+provider\s*=\s*["']([^"']+)["']/);

                const session = sessionMatch ? sessionMatch[1] : null;
                const provider = providerMatch ? providerMatch[1] : null;
                const episode = document.querySelector('.episode-menu #episodeMenu')?.textContent?.trim()?.replace(/\D/g, '') || null;

                console.log('🔍 [BROWSER] Extracted session:', session ? 'Found' : 'Not found');
                console.log('🔍 [BROWSER] Extracted provider:', provider ? 'Found' : 'Not found');

                // Extract resolutions with better debugging
                const resolutions = [];
                const resolutionButtons = document.querySelectorAll('#resolutionMenu button');
                
                console.log('🔍 [BROWSER] Found', resolutionButtons.length, 'resolution buttons');
                
                resolutionButtons.forEach((button, index) => {
                    const url = button.getAttribute('data-src');
                    const resolution = button.getAttribute('data-resolution');
                    const audio = button.getAttribute('data-audio');
                    const fanSub = button.getAttribute('data-fansub');
                    
                    console.log(`🔍 [BROWSER] Resolution ${index + 1}:`, { url: url ? 'Found' : 'Missing', resolution, audio, fanSub });
                    
                    if (url) {
                        resolutions.push({
                            url: url,
                            resolution: resolution || null,
                            isDub: (audio && audio.toLowerCase() === 'eng') || false,
                            fanSub: fanSub || null
                        });
                    }
                });

                // Extract download links
                const downloadLinks = [];
                const downloadButtons = document.querySelectorAll('#pickDownload a');
                
                console.log('🔍 [BROWSER] Found', downloadButtons.length, 'download buttons');
                
                downloadButtons.forEach((link, index) => {
                    const url = link.getAttribute('href');
                    if (url) {
                        const fullText = link.textContent.trim();
                        const match = fullText.match(/(?:(\w+)\s*·\s*(\d+p)\s*\((\d+(?:\.\d+)?(?:MB|GB))\))(?:\s*(eng))?/i);
                        
                        downloadLinks.push({
                            url: url,
                            fansub: match ? match[1] : null,
                            quality: match ? match[2] : fullText,
                            filesize: match ? match[3] : null,
                            isDub: match && match[4] ? true : false
                        });
                    }
                });

                console.log('🔍 [BROWSER] Data extraction completed');
                return {
                    ids,
                    session,
                    provider,
                    episode,
                    resolutions,
                    downloadLinks
                };
            });

            console.log(`📊 [CLIENT-SIDE] Extracted ${episodeData.resolutions.length} resolutions to process`);

            if (episodeData.resolutions.length === 0) {
                throw new Error('No streaming resolutions found on the page');
            }

            // Now scrape each iframe to get the actual streaming URLs
            const sources = [];
            
            for (let i = 0; i < episodeData.resolutions.length; i++) {
                const resData = episodeData.resolutions[i];
                try {
                    console.log(`🎯 [CLIENT-SIDE] Processing ${resData.resolution}p resolution iframe (${i + 1}/${episodeData.resolutions.length})...`);
                    
                    // Use the same browser context to fetch iframe - THIS BYPASSES CLOUDFLARE
                    const iframeResponse = await page.goto(resData.url, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 20000 
                    });

                    if (iframeResponse.ok()) {
                        console.log(`🔓 [CLIENT-SIDE] Successfully accessed ${resData.resolution}p iframe (no blocking!)`);
                        
                        // Wait for any dynamic content to load
                        await page.waitForTimeout(2000);
                        
                        const iframeHtml = await page.content();
                        
                        // Check if we got blocked
                        if (iframeHtml.includes('DDoS-Guard') || iframeHtml.includes('checking your browser')) {
                            console.log(`❌ [CLIENT-SIDE] ${resData.resolution}p iframe blocked by DDoS-Guard`);
                            continue;
                        }
                        
                        // Extract and execute the eval code
                        const evalMatch = iframeHtml.match(/(eval)(\(f.*?)(\n<\/script>)/s);
                        if (evalMatch) {
                            console.log(`🔍 [CLIENT-SIDE] Found eval code in ${resData.resolution}p iframe`);
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
                                    console.log(`✅ [CLIENT-SIDE] Successfully extracted ${resData.resolution}p m3u8 URL`);
                                } else {
                                    console.log(`⚠️ [CLIENT-SIDE] No m3u8 URL found in decoded content for ${resData.resolution}p`);
                                }
                            } catch (evalError) {
                                console.log(`❌ [CLIENT-SIDE] Failed to execute eval code for ${resData.resolution}p:`, evalError.message);
                            }
                        } else {
                            console.log(`⚠️ [CLIENT-SIDE] No eval code found in ${resData.resolution}p iframe`);
                            console.log(`📄 [CLIENT-SIDE] Iframe content preview:`, iframeHtml.substring(0, 300));
                        }
                    } else {
                        console.log(`❌ [CLIENT-SIDE] Failed to load ${resData.resolution}p iframe: ${iframeResponse.status()}`);
                    }
                    
                    // Small delay between requests to avoid rate limiting
                    if (i < episodeData.resolutions.length - 1) {
                        await page.waitForTimeout(1500);
                    }
                    
                } catch (error) {
                    console.error(`❌ [CLIENT-SIDE] Failed to process ${resData.resolution}p:`, error.message);
                }
            }

            const result = {
                ids: episodeData.ids,
                session: episodeData.session,
                provider: episodeData.provider,
                episode: episodeData.episode,
                sources: sources,
                downloadLinks: episodeData.downloadLinks
            };

            console.log(`🎉 [CLIENT-SIDE] Scraping completed! Found ${sources.length} working sources out of ${episodeData.resolutions.length} resolutions`);
            
            if (sources.length === 0) {
                throw new Error('No streaming sources could be extracted from any resolution');
            }
            
            return result;

        } catch (error) {
            console.error('❌ [CLIENT-SIDE] Browser scraping failed:', error.message);
            throw new CustomError(`Client-side scraping failed: ${error.message}`, 503);
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
    }
}

module.exports = ClientScraper;
