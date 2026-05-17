const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLoggedIn, isAdmin, redirectIfLoggedIn } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const bookingController = require('../controllers/bookingController');
const eventModel = require('../models/event');
const mongoose = require('mongoose');

// --- PUBLIC / GUEST ROUTES ---
router.get('/', redirectIfLoggedIn, (req, res) => {
    res.redirect('/guest');
});
router.get("/guest", redirectIfLoggedIn, userController.getGuestDashboard);
router.get("/event", async (req, res) => {
    try {
        let event = null;
        if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
            event = await eventModel.findById(req.query.eventId);
        }
        if (!event) {
            event = await eventModel.findOne().sort({ startDate: 1 });
        }
        res.render("event", { event });
    } catch (err) {
        res.render("event", { event: null });
    }
});

// --- AUTHENTICATION ROUTES ---
router.get('/register', redirectIfLoggedIn, userController.getRegister);
router.post('/register', redirectIfLoggedIn, userController.postRegister);
router.get('/login', redirectIfLoggedIn, userController.getLogin);
router.post('/login', redirectIfLoggedIn, userController.postLogin);

// Password Reset Flow
router.get('/reset-password', redirectIfLoggedIn, userController.getForgotPassword);
router.post('/reset-password', redirectIfLoggedIn, userController.postForgotPassword);
router.get('/verify-code', redirectIfLoggedIn, userController.getVerifyCode);
router.post('/verify-code', redirectIfLoggedIn, userController.postVerifyCode);
router.get('/create-password', redirectIfLoggedIn, userController.getCreatePassword);
router.post('/create-password', redirectIfLoggedIn, userController.postCreatePassword);

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
router.get("/bookings/load-more", isLoggedIn, userController.loadMoreBookings);
router.get("/bookings/manage/:bookingId", isLoggedIn, bookingController.getManageBooking);
router.get("/tickets/:ticketCode", bookingController.getTicketDetails);

router.get("/catalog", userController.getCatalog);


router.post('/profile/upload-avatar', isLoggedIn, upload.avatarUpload.single('avatar'), userController.updateAvatar);

// --- FUNCTIONAL ROUTES ---
router.post('/bookings/create', isLoggedIn, bookingController.createBooking);
router.post('/api/khalti/initiate', isLoggedIn, bookingController.initiateKhaltiPayment);
router.post('/api/khalti/verify', isLoggedIn, bookingController.verifyKhaltiPayment);
router.get('/payments/success', isLoggedIn, bookingController.getPaymentSuccessPage);
router.get('/payments/khalti/success', isLoggedIn, bookingController.getKhaltiSuccessPage);
router.post('/bookings/cancel/:eventId', isLoggedIn, userController.cancelBooking);
router.post('/bookings/cancel-booking/:bookingId', isLoggedIn, userController.cancelBookingById);
router.get('/events/search', userController.searchEvents);



router.get("/eventcreat", (req, res) => {
    res.send("this is the file yet to be created.");
});

// --- POLICY & CONTACT ROUTES ---
router.get("/terms", (req, res) => {
    res.render("terms");
});

router.get("/privacy", (req, res) => {
    res.render("privacy");
});

router.get("/contact", (req, res) => {
    res.render("contact");
});

router.post("/contact", (req, res) => {
    // Basic form handling: in a real app, this would send an email or save to DB.
    // For now, we'll just show a success flash message and redirect back to the form.
    req.flash("success", "Thank you for your message. We will get back to you shortly.");
    res.redirect("/contact");
});

module.exports = router;
