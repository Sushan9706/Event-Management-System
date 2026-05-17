const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const { isLoggedIn } = require('../middlewares/auth');

router.get('/', venueController.getVenues);
router.get('/search', venueController.searchVenues);
router.get('/payments/esewa/success/:transactionUuid?', isLoggedIn, venueController.handleVenueEsewaSuccess);
router.get('/:id', venueController.getVenueById);
router.post('/book', isLoggedIn, venueController.bookVenue);

module.exports = router;
