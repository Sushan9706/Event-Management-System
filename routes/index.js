const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Auth pages removed; keep home/logout lightweight

// Home Route
router.get('/', userController.getHome);

// Admin Dashboard (Protected by role check)
// router.get('/admin/dashboard', isLoggedIn, isAdmin, (req, res) => {
//     // Make sure you have an adminDashboard.ejs file in your views folder!
//     res.render('adminDashboard', { user: req.user });
// });

// Logout Route
router.get('/logout', userController.logout);

module.exports = router;
