const cheerio = require('cheerio');
const DataProcessor = require('../utils/dataProcessor');
const Animepahe = require('../scrapers/animepahe');
const { getJsVariable } = require('../utils/jsParser');
const { CustomError } = require('../middleware/errorHandler');

class AnimeInfoModel {
    static async getAnimeInfo(animeId) {
        const results = await Animepahe.getData("animeInfo", { animeId }, false);
        
        if (results?.data) {
            return DataProcessor.processApiData(results);
        }
        
        return this.scrapeInfoPage(results);
    }
    
    static async getAnimeReleases(animeId, sort, page) {
        const results = await Animepahe.getData("releases", { animeId, sort, page });

        if (!results) {
            throw new CustomError('Failed to fetch anime releases', 503);
        }

        if (typeof results === 'object' && !results.data) {
            results.data = [];
        }

        if (!results.data) {
            throw new CustomError('No release data available', 404);
        }

        results._id = animeId;
        return DataProcessor.processApiData(results, "releases");
    }
    
    static async scrapeInfoPage(pageHtml) {
        if (!pageHtml) {
            throw new CustomError('Failed to fetch anime info page', 503);
        }

        const $ = cheerio.load(pageHtml);
        const previewUrl = getJsVariable(pageHtml, 'preview');

        const animeInfo = {
            ids: {
                animepahe_id: $('meta[name="id"]').attr('content') || null,
                anidb: $('meta[name="anidb"]').attr('content') || null,
                anilist: $('meta[name="anilist"]').attr('content') || null,
                animePlanet: $('meta[name="anime-planet"]').attr('content') || null,
                ann: $('meta[name="ann"]').attr('content') || null,
                kitsu: $('meta[name="kitsu"]').attr('content') || null,
                mal: $('meta[name="myanimelist"]').attr('content') || null
            },
            title: $('.title-wrapper h1 span').first().text().trim() || null,
            image: $('.poster-wrapper .anime-poster img').attr('data-src') || null,
            preview: previewUrl || null,
            synopsis: $('.content-wrapper .anime-synopsis').text().trim() || null,
            synonym: $('.anime-info p:contains("Synonyms:")').text().split('Synonyms:')[1]?.trim() || null,
            japanese: $('.anime-info p:contains("Japanese:")').text().split('Japanese:')[1]?.trim() || null,
            type: $('.anime-info p:contains("Type:") a').text().trim() || null,
            episodes: $('.anime-info p:contains("Episodes:")').text().replace('Episodes:', "").trim() || null,
            status: $('.anime-info p:contains("Status:") a').text().trim() || null,
            duration: $('.anime-info p:contains("Duration:")').text().split('Duration:')[1]?.trim() || null,
            aired: ($('.anime-info p:contains("Aired:")').text().split('Aired:')[1] || '')
                .replace(/\s+/g, ' ')
                .replace(/to\s+\?/, '')
                .trim()
                .replace(/(\w{3} \d{2}, \d{4}) +to +(\w{3} \d{2}, \d{4})/, '$1 to $2') || null,
            season: $('.anime-info p:contains("Season:") a').text().trim() || null,
            studio: $('.anime-info p:contains("Studio:")').text().split('Studio:')[1]?.trim() || null,
            themes: $('.anime-info p:contains("Themes:")')
                .find('a')
                .map((i, el) => $(el).text().trim())
                .get() || [],
            demographic: $('.anime-info p:contains("Demographic:")')
                .find('a')
                .map((i, el) => $(el).text().trim())
                .get() || [],
            external_links: $('.anime-info p.external-links a').map((i, el) => ({
                name: $(el).text(),
                url: $(el).attr('href').replace(/^(http:)?\/\//, 'https://').replace(/^https:\/\/https:\/\//, 'https://')
            })).get() || [],
            genre: $('.anime-info div.anime-genre ul li a').map((i, el) => $(el).text()).get() || []
        };

        // Add relations and recommendations only if they exist
        const relations = await this.scrapeRelationsSection($);
        if (Object.keys(relations).length > 0) {
            animeInfo.relations = relations;
        }

        const recommendations = await this.scrapeRecommendationsSection($);
        if (recommendations.length > 0) {
            animeInfo.recommendations = recommendations;
        }

        if (!animeInfo.title || !animeInfo.ids.animepahe_id) {
            throw new CustomError('Failed to extract essential anime information', 500);
        }

        return animeInfo;
    }

    static async scrapeRelationsSection($) {
        const relations = {};

        $('.anime-relation > div.col-12.col-sm-6, .anime-relation > div.col-12.col-sm-12').each((i, section) => {
            const $section = $(section);
            const type = $section.find('h4 span').text().trim();

            if (!type || $section.find('div.col-12.col-sm-12.mb-3, div.col-12.col-sm-6.mb-3').length === 0) return;
            
            relations[type] = [];
            
            $section.find('div.col-12.col-sm-12.mb-3, div.col-12.col-sm-6.mb-3').each((j, entry) => {
                const $entry = $(entry);
                const titleLink = $entry.find('h5 a');
                
                relations[type].push({
                    title: titleLink.text().trim(),
                    url: titleLink.attr('href'),
                    session: titleLink.attr('href')?.replace('/anime/', ''),
                    image: $entry.find('a img').attr('data-src'),
                    type: ($entry.find('strong a').first().text().trim() || '?').replace(/\s+/g, ' '),
                    episodes: ($entry.text().match(/(\d+)\s+Episode/) || [, '?'])[1],
                    status: this.extractStatusFromText($entry.text()),
                    season: $entry.find('a[href*="season"]').text().trim()
                });
            });

            if (relations[type].length === 0) delete relations[type];
        });
      
        return relations;
    }

    static async scrapeRecommendationsSection($) {
        const recommendations = [];

        $('div.tab-content.anime-recommendation > div.col-12.col-sm-6.mb-3').each((i, entry) => {
            const $entry = $(entry);
            const titleLink = $entry.find('h5 a');
            
            recommendations.push({
                title: titleLink.text().trim(),
                url: titleLink.attr('href'),
                image: $entry.find('a img').attr('data-src'),
                type: ($entry.find('strong a').first().text().trim() || '?').replace(/\s+/g, ' '),
                episodes: ($entry.text().match(/(\d+)\s+Episode/) || [, '?'])[1],
                status: this.extractStatusFromText($entry.text()),
                season: $entry.find('a[href*="/season/"]').text().trim()
            });
        });

        return recommendations;
    }

    static extractStatusFromText(text) {
        const cleanText = text.replace(/\s+/g, ' ');
        const episodeIndex = cleanText.toLowerCase().lastIndexOf('episode');
        
        if (episodeIndex === -1) return 'Unknown';
        
        const afterEpisode = cleanText.slice(episodeIndex + 'episode'.length).trim();
        const parenStart = afterEpisode.indexOf('(');
        const parenEnd = afterEpisode.indexOf(')');
        
        return (parenStart > -1 && parenEnd > parenStart)
            ? afterEpisode.slice(parenStart + 1, parenEnd).trim()
            : 'Unknown';
    }
}

module.exports = AnimeInfoModel;