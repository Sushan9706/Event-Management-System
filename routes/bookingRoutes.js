const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { isLoggedIn } = require('../middlewares/auth');

// Book an event (POST)
router.post('/book/:eventId', isLoggedIn, bookingController.bookEvent);

// Booking confirmation page (GET)  — shown right after booking
router.get('/confirmation/:bookingId', isLoggedIn, bookingController.getConfirmation);

// My Bookings list (GET)
router.get('/my-bookings', isLoggedIn, bookingController.getMyBookings);

// Manage Booking detail page (GET)
router.get('/manage/:bookingId', isLoggedIn, bookingController.getManageBooking);

// Cancel a booking (POST — called via AJAX from the manage page)
router.post('/cancel/:bookingId', isLoggedIn, bookingController.cancelBooking);

module.exports = router;
