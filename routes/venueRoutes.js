const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const { isLoggedIn } = require('../middlewares/auth');

router.get('/', venueController.getVenues);
router.get('/search', venueController.searchVenues);
router.get('/:id', venueController.getVenueById);

module.exports = router;
