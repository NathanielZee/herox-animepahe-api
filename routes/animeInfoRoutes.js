const express = require('express');
const AnimeInfoController = require('../controllers/animeInfoController');

const router = express.Router();

router.get('/:id', AnimeInfoController.getAnimeInfo);
router.get('/:id/releases', AnimeInfoController.getAnimeReleases);   

module.exports = router;