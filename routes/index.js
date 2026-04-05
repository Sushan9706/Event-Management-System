const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLoggedIn, isAdmin, redirectIfLoggedIn } = require('../middlewares/auth');

router.get('/', redirectIfLoggedIn, userController.getGuestDashboard);

// Registration Routes
router.get('/register', userController.getRegister);
router.post('/register', userController.postRegister);

// Login Routes
router.get('/login', userController.getLogin);
router.post('/login', userController.postLogin);

// User Dashboard Route (Protected)
router.get('/user', isLoggedIn, userController.getUserDashboard);

// Admin Dashboard (Protected by both Login and Admin check)
router.get('/admin/dashboard', isLoggedIn, isAdmin, (req, res) => {
    // Make sure you have an adminDashboard.ejs file in your views folder!
    res.render('adminDashboard', { user: req.user });
});

// search route for searching the events 
router.get('/events/search', userController.searchEvents);

// Logout Route
router.get('/logout', userController.logout);

router.get("/guest", (req, res) => {
  res.render("guest");
});

router.get("/event", (req, res) => {
  res.render("event");
});

router.get("/catalog", (req, res) => {
  res.render("catalog");
});

router.get("/bookings", (req, res) => {
  res.render("bookings");
});

router.get("/profile", (req, res) => {
  res.render("profile");
});

// ❌ removed duplicate /profile route

router.get("/eventcreat", (req, res) => {
  res.send("this is the file yet to be created. ")
});

module.exports = router;