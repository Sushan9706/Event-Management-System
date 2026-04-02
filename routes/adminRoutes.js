const express = require('express');
const router = express.Router();
const adminEventController = require('../controllers/adminEventController');
const { isLoggedIn, isAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// All admin routes require login + admin role
router.use(isLoggedIn, isAdmin);

// ─── MANAGE EVENTS ────────────────────────────────────────────
router.get('/events', adminEventController.getManageEvents);

// ─── CREATE EVENT ─────────────────────────────────────────────
router.get('/events/create', adminEventController.getCreateEvent);
router.post('/events/create', upload.single('banner_image'), adminEventController.postCreateEvent);

// ─── EDIT EVENT ───────────────────────────────────────────────
router.get('/events/edit/:id', adminEventController.getEditEvent);
router.post('/events/edit/:id', upload.single('banner_image'), adminEventController.postEditEvent);

// ─── DELETE EVENT ─────────────────────────────────────────────
router.post('/events/delete/:id', adminEventController.deleteEvent);

// ─── REMOVE EVENT IMAGE ──────────────────────────────────────
router.post('/events/remove-image/:id', adminEventController.removeEventImage);

// ─── BOOKING DETAILS ─────────────────────────────────────────
router.get('/events/:id/bookings', adminEventController.getBookingDetails);

// ─── EXPORT CSV ──────────────────────────────────────────────
router.get('/events/:id/bookings/export', adminEventController.exportBookingsCsv);

module.exports = router;
