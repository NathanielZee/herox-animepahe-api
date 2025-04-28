const BaseScraper = require('../scrapers/baseScraper');
const Config = require('../utils/config');
const ApiClient = require('../scrapers/apiClient');

class HomeModel extends BaseScraper {
    static async getAiringAnime(page) {
        try {
            console.log('Attempting to scrape API data on page', page);
            const apiData = await ApiClient.getData("airing", { page });

            console.log("API DATA", apiData);
            
            if (apiData && (apiData.data)) {
                console.log('Successfully retrieved API data');
                return this.processApiData(apiData);
            } else {
                console.log('API data not in expected format, falling back to HTML scraping');
                return this.scrapeHomePage();
            }
        } catch (error) {
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
            return this.scrapeHomePage();
        }
    }

    static async searchAnime(query, page) {
        try {
            console.log('Attempting to scrape API data on page', page);
            const apiData = await ApiClient.getData("search", { query, page });

            console.log("API DATA", apiData);
            
            if (apiData && (apiData.data)) {
                console.log('Successfully retrieved API data');
                return this.processApiData(apiData, 'search');
            } else {
                console.log('API data not in expected format, falling back to HTML scraping');
                return this.scrapeHomePage();
            }
        } catch (error) {
            console.error('API scraping failed:', error.message);
            console.log('Falling back to HTML scraping');
            return this.scrapeHomePage();
        }
    }
    
    static processApiData(apiData, type = 'airing') {
        console.log(`Processing API data of type: ${type}`);
        
        const items = apiData.data || [];
        
        if (!Array.isArray(items)) {
            console.error('Unexpected API response format:', JSON.stringify(apiData).substring(0, 200));
            throw new Error('Unexpected API response format');
        }
        
        const paginationInfo = this._extractPaginationInfo(apiData, type);

        const dataProcessors = {
            'airing': this._processAiringData,
            'search': this._processSearchData,
            'details': this._processDetailsData,
        };
        
        const processor = dataProcessors[type] || this._processGenericData;
        
        const processedData = processor(items);
        
        if (processedData.length > 0) {
            console.log(`Processed ${processedData.length} items of type: ${type}`);
            console.log("Sample:", processedData[0]);
        }
        
        return { paginationInfo, data: processedData };
    }
    
    static _extractPaginationInfo(apiData, type) {
        const { 
            total, per_page, current_page, last_page, 
            next_page_url, prev_page_url, from, to 
        } = apiData;
        
        return {
            ...(total != null && { total }),
            ...(per_page != null && { perPage: per_page }),
            ...(current_page != null && { currentPage: current_page }),
            ...(last_page != null && { lastPage: last_page }),
            ...(next_page_url != null && { 
                nextPageUrl: next_page_url.replace(
                    new RegExp(`^(${Config.baseUrl}|/)`),  // Match both baseUrl AND leading slash
                    Config.hostUrl
                ).replace('api?', `api/${type}?`)
            }),
            ...(prev_page_url != null && { prevPageUrl: prev_page_url }),
            ...(from != null && { from }),
            ...(to != null && { to })
        };
    }   

    
    static _processAiringData(items) {
        return items.map(item => ({
            id: item.id || null,
            anime_id: item.anime_id || null,
            title: item.anime_title || null,
            episode: item.episode || null,
            episode2: item.episode2 || null,
            edition: item.edition || null,
            fansub: item.fansub || null,
            image: item.snapshot || null,
            disc: item.disc || null,
            session: item.session || null,
            link: (item.session ? `${Config.getUrl('animeInfo', item.session)}` : '') || null,
            filler: item.filler || null,
            created_at: item.created_at || null,
            completed: item.completed || 1
        }));
    }
    
    static _processSearchData(items) {
        return items.map(item => ({
            id: item.id || null,
            title: item.title || null,
            status: item.status || null,
            type: item.type || null,
            episodes: item.episodes || null,
            score: item.score || null,
            year: item.year || null,
            season: item.season || null,
            poster: item.poster || null,
            session: item.session || null,
            link: (item.session ? `${Config.getUrl('animeInfo', item.session)}` : '') || null,
        }));
    }
    
    static _processDetailsData(items) {
        // Do later
        return items.map(item => ({
            id: item.id || null,
            title: item.title || null,
            description: item.description || null,
            // other fields as needed
        }));
    }
    
    // For unknown data types 
    static _processGenericData(items) {
        return items.map(item => {
            // Clone the item but ensure no null property values
            const processed = {};
            Object.keys(item).forEach(key => {
                processed[key] = item[key] || null;
            });
            return processed;
        });
    }
    
    static async scrapeHomePage() {
        console.log('Scraping home page HTML');
        const url = Config.getUrl('home');
        const $ = await this.fetchPage(url);
        
        const airingAnime = [];
        $('.episode-list .episode-wrap').each((i, element) => {
            airingAnime.push({
                title: $(element).find('.episode .episode-title-warap a').text().trim(),
                episode: $(element).find('.episode .episode-number').text().trim(),
                image: $(element).find('.episode .episode-snapshot img').attr('src'),
                link: `${Config.baseUrl}${$(element).find('a').attr('href')}`
            });
        });
         
        console.log(`Scraped ${airingAnime.length} anime items from HTML`);

        if (airingAnime.length === 0) {
            console.log('No items found');

            return [];
        }
        
        return airingAnime;
    }
}

module.exports = HomeModel;