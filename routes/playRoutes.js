const express = require('express');
const PlayController = require('../controllers/playController');

const router = express.Router();

router.get('/play/:id', PlayController.getStreamingLinks);

module.exports = router;