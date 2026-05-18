const express = require('express');
const router = express.Router();
const adminEventController = require('../controllers/adminEventController');
const adminVenueController = require('../controllers/adminVenueController');
const { isLoggedIn, isAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// All admin routes require login + admin role
router.use(isLoggedIn, isAdmin);

// ─── MANAGE EVENTS ────────────────────────────────────────────
router.get('/dashboard', adminEventController.getManageEvents);

// ─── CREATE EVENT ─────────────────────────────────────────────
router.get('/events/create', adminEventController.getCreateEvent);
router.post('/events/create', upload.eventUpload.single('banner_image'), adminEventController.postCreateEvent);

// ─── EDIT EVENT ───────────────────────────────────────────────
router.get('/events/edit/:id', adminEventController.getEditEvent);
router.post('/events/edit/:id', upload.eventUpload.single('banner_image'), adminEventController.postEditEvent);

// ─── DELETE EVENT ─────────────────────────────────────────────
router.post('/events/delete/:id', adminEventController.deleteEvent);

// ─── REMOVE EVENT IMAGE ──────────────────────────────────────
router.post('/events/remove-image/:id', adminEventController.removeEventImage);

// ─── BOOKING DETAILS ─────────────────────────────────────────
router.get('/events/:id/bookings', adminEventController.getBookingDetails);

// ─── NOTIFICATIONS ──────────────────────────────────────────
router.get('/notifications', adminEventController.getNotifications);

// ─── EXPORT CSV ──────────────────────────────────────────────
router.get('/events/:id/bookings/export', adminEventController.exportBookingsCsv);

// ─── MANAGE VENUES ────────────────────────────────────────────
router.get('/venues', adminVenueController.getManageVenues);

// ─── CREATE VENUE ─────────────────────────────────────────────
router.get('/venues/create', adminVenueController.getCreateVenue);
router.post('/venues/create', upload.eventUpload.single('venue_image'), adminVenueController.postCreateVenue);

// ─── EDIT VENUE ───────────────────────────────────────────────
router.get('/venues/edit/:id', adminVenueController.getEditVenue);
router.post('/venues/edit/:id', upload.eventUpload.single('venue_image'), adminVenueController.postEditVenue);

// ─── DELETE VENUE ─────────────────────────────────────────────
router.post('/venues/delete/:id', adminVenueController.deleteVenue);

// ─── VIEW VENUE BOOKINGS ──────────────────────────────────────
router.get('/venues/:id/bookings', adminVenueController.getVenueBookings);
router.get('/venues/export-csv/:id', adminVenueController.exportVenueBookingsCsv);

// ─── CONTACT MESSAGES ─────────────────────────────────────────
router.get('/messages', adminEventController.getMessages);
router.post('/messages/resolve/:id', adminEventController.resolveMessage);

module.exports = router;
