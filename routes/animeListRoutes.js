const express = require('express');
const AnimeListController = require('../controllers/animeListController');

const router = express.Router();

router.get('/anime', AnimeListController.getAllAnime);
router.get('/anime/:tag1/:tag2', AnimeListController.getAnimeByTags);

module.exports = router;