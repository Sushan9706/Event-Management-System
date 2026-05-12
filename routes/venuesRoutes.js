const express = require("express");
const router = express.Router();
const Venue = require("../models/venueModel");
const Booking = require("../models/bookingModel");
const User = require("../models/user");
const { isLoggedIn } = require("../middleware/auth");

// ── GET /venues  –  public catalog ──
router.get("/", async (req, res) => {
  try {
    let venues = await Venue.find({ active: true }).sort({ name: 1 });
    
    // Seed if empty (first run)
    if (venues.length === 0) {
      venues = await Venue.insertMany([
        { name: "Amber Hall", location: "Kathmandu", category: "Conference", capacity: 300, ratePerDay: 45000 },
        { name: "Blue Ridge Pavilion", location: "Lalitpur", category: "Outdoor", capacity: 500, ratePerDay: 62000 },
        { name: "Cedar Boardroom", location: "Kathmandu", category: "Boardroom", capacity: 20, ratePerDay: 8500 },
        { name: "Everest Suite", location: "Kathmandu", category: "Banquet", capacity: 800, ratePerDay: 120000 },
        { name: "Fern Garden", location: "Bhaktapur", category: "Outdoor", capacity: 200, ratePerDay: 35000 },
        { name: "Grand Auditorium", location: "Lalitpur", category: "Auditorium", capacity: 1200, ratePerDay: 180000 }
      ]);
    }

    res.render("venues", { venues, title: "Venues – EMS" });
  } catch (err) {
    console.error("Venues route error:", err);
    res.status(500).send("Error loading venues");
  }
});

// ── GET /venues/:id/book  –  direct booking action ──
router.get("/:id/book", isLoggedIn, async (req, res) => {
  try {
    const venueId = req.params.id;
    const userId = req.user.userId;

    const [venue, user] = await Promise.all([
      Venue.findById(venueId),
      User.findById(userId)
    ]);

    if (!venue) return res.status(404).send("Venue not found");
    if (!user) return res.status(404).send("User not found");

    // Create a booking record
    const ref = `VEN-${Date.now().toString(36).toUpperCase()}`;
    const booking = await Booking.create({
      venueId: venue._id,
      userEmail: user.email,
      userName: user.username,
      totalAmount: venue.ratePerDay,
      referenceNumber: ref,
      status: "confirmed"
    });

    // Notify user
    user.notifications.unshift({
      type: "booking_confirmed",
      eventName: venue.name,
      createdAt: new Date(),
      message: `You have successfully booked ${venue.name}.`
    });
    if (user.notifications.length > 20) user.notifications.pop();
    await user.save();

    res.redirect("/bookings?success=venue_booked");
  } catch (err) {
    console.error("Venue booking error:", err);
    res.status(500).send("Failed to process booking");
  }
});

module.exports = router;
