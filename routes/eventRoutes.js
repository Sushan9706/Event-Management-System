const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// All events
router.get('/', eventController.getAllEvents);

// Single event
router.get('/:id', eventController.getEventById);

module.exports = router;
