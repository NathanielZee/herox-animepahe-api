const cheerio = require('cheerio');
const DataProcessor = require('../utils/dataProcessor');
const Animepahe = require('../scrapers/animepahe');
const { CustomError } = require('../middleware/errorHandler');

class AnimeListModel {
    static async getAnimeList(tab, tag1, tag2) {
        const results = await Animepahe.getData("animeList", { tag1, tag2 }, false);
        
        if (results?.data) {
            return DataProcessor.processApiData(results);
        }
        
        return this.scrapeAnimeListPage(results, tab);
    }

    static async scrapeAnimeListPage(pageHtml, tab) {
        if (!pageHtml) {
            throw new CustomError('Failed to fetch anime list page', 503);
        }

        const $ = cheerio.load(pageHtml);
        const animeList = [];
        
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
            const targetId = tab === '#' || tab === 'hash' ? 'hash' : tab.toUpperCase();
            const $pane = $(`div.tab-pane#${targetId}`);
            
            if (!$pane.length) {
                throw new CustomError(`No content found for tab: ${tab}`, 404);
            }
            
            processPane($pane);
        } else {
            $('div.tab-content div.tab-pane').each((i, pane) => {
                processPane(pane);
            });
        }

        if (animeList.length === 0) {
            throw new CustomError('No anime entries found', 404);
        }

        return animeList;
    }
}

module.exports = AnimeListModel;