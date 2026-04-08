const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLoggedIn, isAdmin, redirectIfLoggedIn } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// --- PUBLIC / GUEST ROUTES ---
router.get('/', redirectIfLoggedIn, userController.getGuestDashboard);
router.get("/guest", (req, res) => res.render("guest"));
router.get("/event", (req, res) => res.render("event"));

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
    upload.single('avatar'),
    userController.updateProfileInfo
);

router.get("/bookings", isLoggedIn, (req, res) => {
    res.render("bookings", { user: req.user });
});

router.get("/catalog", isLoggedIn, (req, res) => {
    res.render("catalog", { user: req.user });
});

router.post('/profile/upload-avatar', isLoggedIn, upload.single('avatar'), userController.updateAvatar);

// --- FUNCTIONAL ROUTES ---
router.get('/events/search', userController.searchEvents);

router.get("/eventcreat", (req, res) => {
    res.send("this is the file yet to be created.");
});

module.exports = router;