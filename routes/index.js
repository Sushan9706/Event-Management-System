const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLoggedIn, isAdmin, redirectIfLoggedIn, isUser } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const bookingController = require('../controllers/bookingController');
const eventModel = require('../models/event');
const mongoose = require('mongoose');

// --- PUBLIC / GUEST ROUTES ---
router.get('/', (req, res) => {
    const jwt = require("jsonwebtoken");
    const token = req.cookies && req.cookies.token;
    if (token) {
        try {
            const user = jwt.verify(token, "shhhhhhhhh");
            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/user');
            }
        } catch (err) {
            return res.redirect('/guest');
        }
    }
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
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            event = await eventModel.findOne({ date: { $gte: today } }).sort({ date: 1 });
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
router.get('/user', isLoggedIn, isUser, userController.getUserDashboard);

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

router.get("/bookings", isLoggedIn, isUser, bookingController.getBookingsPage);
router.get("/bookings/manage/:bookingId", isLoggedIn, isUser, bookingController.getManageBooking);

router.get("/catalog", userController.getCatalog);


router.post('/profile/upload-avatar', isLoggedIn, upload.avatarUpload.single('avatar'), userController.updateAvatar);

// --- FUNCTIONAL ROUTES ---
router.post('/bookings/create', isLoggedIn, isUser, bookingController.createBooking);
router.post('/bookings/cancel/:eventId', isLoggedIn, isUser, userController.cancelBooking);
router.post('/bookings/cancel-booking/:bookingId', isLoggedIn, isUser, userController.cancelBookingById);
router.get('/events/search', userController.searchEvents);

router.get("/forgot-password", userController.getForgotPassword);
router.post("/forgot-password", userController.postForgotPassword);

router.get("/verify-otp", userController.getVerifyOTP);
router.post("/verify-otp", userController.postVerifyOTP);

router.get("/eventcreat", (req, res) => {
    res.send("this is the file yet to be created.");
});

module.exports = router;
