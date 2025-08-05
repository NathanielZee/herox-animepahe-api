// models/playModel.js - Updated to ONLY use client-side scraping
const ClientScraper = require('../utils/clientScraper');
const { CustomError } = require('../middleware/errorHandler');

class PlayModel {
    static async getStreamingLinks(id, episodeId) {
        console.log(`🎬 [CLIENT-SIDE] Getting streaming links for ${id}/${episodeId}`);
        
        try {
            console.log('🌐 [CLIENT-SIDE] Using browser automation to bypass IP blocking...');
            const result = await ClientScraper.scrapePlayPage(id, episodeId);
            
            if (!result || !result.sources || result.sources.length === 0) {
                throw new CustomError('No streaming sources found', 404);
            }
            
            console.log(`✅ [CLIENT-SIDE] Successfully extracted ${result.sources.length} streaming sources`);
            return result;
            
        } catch (error) {
            console.error('❌ [CLIENT-SIDE] Scraping failed:', error.message);
            throw new CustomError(`Client-side scraping failed: ${error.message}`, 503);
        }
    }
}

module.exports = PlayModel;
