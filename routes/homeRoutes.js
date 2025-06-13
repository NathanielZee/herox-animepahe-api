const express = require('express');
const cache = require('../middleware/cache');
const HomeController = require('../controllers/homeController');

const router = express.Router();

router.get('/airing', cache(30), HomeController.getAiringAnime);
router.get('/search', cache(120), HomeController.searchAnime);

module.exports = router;