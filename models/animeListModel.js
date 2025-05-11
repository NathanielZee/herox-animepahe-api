const cheerio = require('cheerio');
const BaseScraper = require('../scrapers/baseScraper');
const DataProcessor = require('../utils/dataProcessor');
const ApiClient = require('../scrapers/apiClient');
const Config = require('../utils/config');

class AnimeListModel extends BaseScraper {
    static async getAnimeList(tab, tag1, tag2) {
        try {
            const apiData = await ApiClient.getData("animeList", { tag1, tag2 }, false);
            
            if (apiData?.data) {
                return DataProcessor.processApiData(apiData);
            } else {
                return this.scrapeAnimeListPage(apiData, tab);
            }
        } catch (error) {
            console.error('AnimeList processing failed:', error);
            throw error;
        }
    }

    static async scrapeAnimeListPage(pageHtml, tab) {
        const $ = cheerio.load(pageHtml);
        const animeList = [];
        
        // Handle both cases: specific tab or all tabs
        const processPane = (pane) => {
            $(pane).find('div.col-12.col-md-6').each((j, entry) => {
                const $entry = $(entry);
                const $link = $entry.find('a');
                const $badge = $entry.find('span.badge');

                animeList.push({
                    title: $link.attr('title') || $link.text().trim(),
                    url: $link.attr('href'),
                    type: $badge.length ? $badge.first().text().trim() : null
                });
            });
        };

        if (typeof tab !== 'undefined') {
            // Specific tab processing
            const targetId = tab === '#' ? 'hash' : tab.toUpperCase();
            const $pane = $(`div.tab-pane#${targetId}`);
            
            if (!$pane.length) {
                console.warn(`No section found for tab: ${tab}`);
                return [];
            }
            
            processPane($pane);
        } else {
            // Process all tabs if no specific tab requested
            $('div.tab-content div.tab-pane').each((i, pane) => {
                processPane(pane);
            });
        }

        console.log(`Found ${animeList.length} anime entries${tab ? ` in ${tab} section` : ''}`);
        return animeList;
    }

}

module.exports = AnimeListModel;