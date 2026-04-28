const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLoggedIn, isAdmin, redirectIfLoggedIn } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const bookingController = require('../controllers/bookingController');
const eventModel = require('../models/event');
const Booking = require('../models/bookingModel');
const { ACTIVE_BOOKING_STATUSES, hasEventEnded } = require('../utils/bookingStatus');
const mongoose = require('mongoose');

// --- PUBLIC / GUEST ROUTES ---
router.get('/', (req, res) => {
    res.redirect('/guest');
});
router.get("/guest", userController.getGuestDashboard);
router.get("/event", async (req, res) => {
    try {
        let event = null;
        if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
            event = await eventModel.findById(req.query.eventId);
        }
        if (!event) {
            event = await eventModel.findOne().sort({ date: 1 });
        }
        if (event) {
            const seatAgg = await Booking.aggregate([
                { $match: { eventId: event._id, status: { $in: ACTIVE_BOOKING_STATUSES } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$ticketCount", 1] } } } }
            ]);
            const currentBookings = seatAgg.length > 0 ? seatAgg[0].total : 0;
            const maxCapacity = Number(event.maxCapacity) || 0;
            const hasCapacityLimit = maxCapacity > 0;

            event.currentBookings = currentBookings;
            event.availableTickets = hasCapacityLimit ? Math.max(maxCapacity - currentBookings, 0) : null;
            event.isSoldOut = hasCapacityLimit ? event.availableTickets <= 0 : false;
            event.hasEnded = hasEventEnded(event);
        }
        res.render("event", { event });
    } catch (err) {
        res.render("event", { event: null });
    }
});

// --- AUTHENTICATION ROUTES ---
router.get('/register', userController.getRegister);
router.post('/register', userController.postRegister);
router.get('/login', userController.getLogin);
router.post('/login', userController.postLogin);
router.get('/logout', userController.logout);

// --- PROTECTED USER ROUTES (Requires isLoggedIn) ---
router.get('/user', isLoggedIn, userController.getUserDashboard);

// This is the specific update you asked for:
router.get("/profile", isLoggedIn, userController.getProfile);

router.post('/profile/update-password', isLoggedIn, userController.updatePassword);

// Ensure your route uses the upload middleware to look for the avatar field within the form data.
router.post(
    '/profile/update-info',
    isLoggedIn,
    upload.avatarUpload.single('avatar'),
    userController.updateProfileInfo
);

router.get("/bookings", isLoggedIn, bookingController.getBookingsPage);
router.get("/bookings/manage/:bookingId", isLoggedIn, bookingController.getManageBooking);

router.get("/catalog", userController.getCatalog);


router.post('/profile/upload-avatar', isLoggedIn, upload.avatarUpload.single('avatar'), userController.updateAvatar);

// --- FUNCTIONAL ROUTES ---
router.post('/bookings/create', isLoggedIn, bookingController.createBooking);
router.post('/bookings/cancel/:eventId', isLoggedIn, userController.cancelBooking);
router.post('/bookings/cancel-booking/:bookingId', isLoggedIn, userController.cancelBookingById);
router.get('/events/search', userController.searchEvents);



router.get("/eventcreat", (req, res) => {
    res.send("this is the file yet to be created.");
});

module.exports = router;
