const express = require('express');
const HomeController = require('../controllers/homeController');

const router = express.Router();

router.get('/home', HomeController.getFeaturedAnime);

module.exports = router;