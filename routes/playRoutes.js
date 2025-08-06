// Add this to your routes/playRoutes.js for debugging
const express = require('express');
const PlayController = require('../controllers/playController');
const { launchBrowser } = require('../utils/browser');

const router = express.Router();

router.get('/play/:id', PlayController.getStreamingLinks);

// Debug endpoint to test browser functionality
router.get('/debug/browser-test', async (req, res) => {
    try {
        console.log('🧪 [DEBUG] Testing browser launch...');
        const browser = await launchBrowser();
        
        const page = await browser.newPage();
        await page.goto('https://httpbin.org/get', { timeout: 10000 });
        const title = await page.title();
        
        await browser.close();
        
        res.json({
            success: true,
            title: title,
            message: 'Browser test successful',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to test animepahe page loading
router.get('/debug/animepahe-test/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { episodeId } = req.query;
        
        if (!episodeId) {
            return res.status(400).json({ error: 'episodeId query parameter required' });
        }
        
        console.log(`🧪 [DEBUG] Testing animepahe page load for ${id}/${episodeId}`);
        const browser = await launchBrowser();
        const page = await browser.newPage();
        
        const playUrl = `https://animepahe.ru/play/${id}/${episodeId}`;
        console.log('📺 [DEBUG] Loading:', playUrl);
        
        const response = await page.goto(playUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        await page.waitForTimeout(3000);
        
        const pageInfo = await page.evaluate(() => {
            const hasResolutionMenu = document.querySelector('#resolutionMenu') !== null;
            const hasEpisodeMenu = document.querySelector('#episodeMenu') !== null;
            const resolutionCount = document.querySelectorAll('#resolutionMenu button').length;
            const title = document.title;
            const pageText = document.body ? document.body.textContent.substring(0, 200) : 'No body';
            
            return {
                hasResolutionMenu,
                hasEpisodeMenu,
                resolutionCount,
                title,
                pageText,
                url: window.location.href
            };
        });
        
        await browser.close();
        
        res.json({
            success: true,
            playUrl,
            responseStatus: response.status(),
            pageInfo,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
