const ApiScraper = require('./apiScraper');
const Config = require('../utils/config');

class AnimeApiScraper {
    static async getAiringAnime(page = 1) {
        const apiEndpoints = [
            `api?m=airing&page=${page}`,
            `api/airing?page=${page}`,
            `api/airing/${page}`
        ];
        
        // Try each endpoint until one works
        for (const endpoint of apiEndpoints) {
            try {
                console.log(`Trying API endpoint: ${endpoint}`);
                const data = await ApiScraper.fetchApiData(endpoint);
                if (data && (data.data || data.items || data.results)) {
                    console.log(`Successfully retrieved data from ${endpoint}`);
                    return data;
                }
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error.message);
            }
        }
        
        throw new Error('Failed to fetch airing anime from any API endpoint');
    }
    
    static async getAnimeInfo(id) {
        const apiEndpoints = [
            `api?m=anime&id=${id}`,
            `api/anime/${id}`,
            `api/info/${id}`
        ];
        
        // Try each endpoint until one works
        for (const endpoint of apiEndpoints) {
            try {
                console.log(`Trying API endpoint: ${endpoint}`);
                const data = await ApiScraper.fetchApiData(endpoint);
                if (data) {
                    console.log(`Successfully retrieved data from ${endpoint}`);
                    return data;
                }
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error.message);
            }
        }
        
        throw new Error(`Failed to fetch anime info for ID ${id} from any API endpoint`);
    }
    
    static async searchAnime(query, page = 1) {
        const apiEndpoints = [
            `api?m=search&q=${encodeURIComponent(query)}&page=${page}`,
            `api/search?q=${encodeURIComponent(query)}&page=${page}`,
            `api/search/${encodeURIComponent(query)}/${page}`
        ];
        
        // Try each endpoint until one works
        for (const endpoint of apiEndpoints) {
            try {
                console.log(`Trying API endpoint: ${endpoint}`);
                const data = await ApiScraper.fetchApiData(endpoint);
                if (data) {
                    console.log(`Successfully retrieved data from ${endpoint}`);
                    return data;
                }
            } catch (error) {
                console.error(`Failed to fetch from ${endpoint}:`, error.message);
            }
        }
        
        throw new Error(`Failed to search anime for query "${query}" from any API endpoint`);
    }
}

module.exports = AnimeApiScraper;