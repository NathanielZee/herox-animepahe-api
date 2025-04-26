const express = require('express');
const HomeController = require('../controllers/homeController');

const router = express.Router();

router.get('/airing', HomeController.getAiringAnime);
router.get('/search', HomeController.searchAnime);

module.exports = router;