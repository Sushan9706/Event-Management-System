const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Update this line to include isAdmin
const { isLoggedIn, isAdmin } = require('../middlewares/auth');

// Home Route (Protected)
router.get('/', isLoggedIn, userController.getHome);

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

// Logout Route
router.get('/logout', userController.logout);

module.exports = router;