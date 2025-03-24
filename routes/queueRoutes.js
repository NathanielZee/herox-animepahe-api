const express = require('express');
const QueueController = require('../controllers/queueController');

const router = express.Router();

router.get('/queue', QueueController.getQueue);

module.exports = router;