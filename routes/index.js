const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  isLoggedIn,
  isAdmin,
  redirectIfLoggedIn,
} = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const bookingController = require("../controllers/bookingController");
const dummyEsewaController = require("../controllers/dummyEsewaController");
const eventModel = require("../models/event");
const mongoose = require("mongoose");

// --- PUBLIC / GUEST ROUTES ---
router.get("/", redirectIfLoggedIn, (req, res) => {
  res.redirect("/guest");
});
router.get("/guest", redirectIfLoggedIn, userController.getGuestDashboard);
router.get("/event", async (req, res) => {
  try {
    let event = null;
    if (
      req.query.eventId &&
      mongoose.Types.ObjectId.isValid(req.query.eventId)
    ) {
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
router.get("/register", redirectIfLoggedIn, userController.getRegister);
router.post("/register", redirectIfLoggedIn, userController.postRegister);
router.get("/login", redirectIfLoggedIn, userController.getLogin);
router.post("/login", redirectIfLoggedIn, userController.postLogin);
router.get(
  "/reset-password",
  redirectIfLoggedIn,
  userController.getResetPassword
);
router.get("/logout", userController.logout);

// --- PROTECTED USER ROUTES (Requires isLoggedIn) ---
router.get("/user", isLoggedIn, userController.getUserDashboard);

// This is the specific update you asked for:
router.get("/profile", isLoggedIn, userController.getProfile);



router.post(
  "/profile/update-password",
  isLoggedIn,
  userController.updatePassword
);

// Ensure your route uses the upload middleware to look for the avatar field within the form data.
router.post(
  "/profile/update-info",
  isLoggedIn,
  upload.avatarUpload.single("avatar"),
  userController.updateProfileInfo
);

router.get("/bookings", isLoggedIn, bookingController.getBookingsPage);
router.get("/venue-bookings", isLoggedIn, bookingController.getVenueBookingsPage);
router.get("/bookings/load-more", isLoggedIn, userController.loadMoreBookings);
router.get(
  "/bookings/manage/:bookingId",
  isLoggedIn,
  bookingController.getManageBooking
);
router.get("/tickets/:ticketCode", bookingController.getTicketDetails);

router.get("/catalog", userController.getCatalog);

router.post(
  "/profile/upload-avatar",
  isLoggedIn,
  upload.avatarUpload.single("avatar"),
  userController.updateAvatar
);

// --- FUNCTIONAL ROUTES ---
router.post("/bookings/create", isLoggedIn, bookingController.createBooking);
router.get(
  "/payments/esewa/success",
  isLoggedIn,
  bookingController.handleEsewaSuccess
);
router.get(
  "/payments/esewa/failure/:transactionUuid",
  isLoggedIn,
  bookingController.handleEsewaFailure
);
router.post("/dummy-esewa/start", isLoggedIn, dummyEsewaController.start);
router.get("/dummy-esewa/auth", isLoggedIn, dummyEsewaController.auth);
router.get(
  "/dummy-esewa/register",
  isLoggedIn,
  dummyEsewaController.registerForm
);
router.post("/dummy-esewa/register", isLoggedIn, dummyEsewaController.register);
router.post("/dummy-esewa/login", isLoggedIn, dummyEsewaController.login);
router.get(
  "/dummy-esewa/dashboard",
  isLoggedIn,
  dummyEsewaController.dashboard
);
router.post("/dummy-esewa/pay", isLoggedIn, dummyEsewaController.pay);
router.post("/dummy-esewa/cancel", isLoggedIn, dummyEsewaController.cancel);
router.post(
  "/bookings/cancel/:eventId",
  isLoggedIn,
  userController.cancelBooking
);
router.post(
  "/bookings/cancel-booking/:bookingId",
  isLoggedIn,
  userController.cancelBookingById
);
router.get("/notifications", isLoggedIn, userController.getUserNotifications);
router.post(
  "/notifications/mark-as-read/:notifId",
  isLoggedIn,
  userController.markNotificationAsRead
);
router.get("/events/search", userController.searchEvents);

router.get("/eventcreat", (req, res) => {
  res.send("this is the file yet to be created.");
});

// ... all your routes ...

router.post(
  "/notifications/mark-all-read",
  isLoggedIn,
  userController.markAllNotificationsRead
);


module.exports = router; // ✅ always last
