const cheerio = require('cheerio');
const RequestManager = require('../utils/requestManager');
const ApiScraper = require('./apiScraper');

class BaseScraper {
    static async fetchPage(url) {
        const html = await RequestManager.fetch(url);
        return cheerio.load(html);
    }
    
    static async fetchApiData(endpoint, page = 1) {
        return await ApiScraper.fetchApiData(endpoint, page);
    }
    
    static extractId(url) {
        const match = url.match(/\/([^\/]+)(?:\/|$)/);
        return match ? match[1] : null;
    }
    
    static formatApiResponse(data, schema) {
        // Generic function to map API response to a consistent format
        if (!data) return null;
        
        if (Array.isArray(data)) {
            return data.map(item => this.mapObjectToSchema(item, schema));
        } else if (data.data && Array.isArray(data.data)) {
            return data.data.map(item => this.mapObjectToSchema(item, schema));
        } else {
            return this.mapObjectToSchema(data, schema);
        }
    }
    
    static mapObjectToSchema(obj, schema) {
        const result = {};
        for (const [key, mapping] of Object.entries(schema)) {
            if (typeof mapping === 'string') {
                // Simple mapping
                result[key] = obj[mapping] || '';
            } else if (Array.isArray(mapping)) {
                // Try multiple field names
                for (const field of mapping) {
                    if (obj[field] !== undefined) {
                        result[key] = obj[field];
                        break;
                    }
                }
                if (result[key] === undefined) result[key] = '';
            } else if (typeof mapping === 'function') {
                // Custom mapping function
                result[key] = mapping(obj);
            }
        }
        return result;
    }
}

module.exports = BaseScraper;