const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userModel = require("../models/user");
const eventModel = require("../models/event");
const categoryModel = require("../models/categoryModel");
const mongoose = require("mongoose");
const {
  syncBookingExpiry,
  syncBookingsExpiry,
} = require("../utils/bookingStatus");

exports.getRegister = (req, res) => {
  res.render("register");
};

exports.postRegister = async (req, res) => {
  try {
    let { username, email, password, confirmPassword } = req.body;
    const errors = [];

    // 1. Unified Password Validation (Regex)
    // This regex ensures: 8+ chars, at least 1 letter, 1 number, 1 symbol, and NO spaces
    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])(?!.*\s).{8,}$/;

    if (!passwordRegex.test(password)) {
      errors.push(
        "Password must be at least 8 characters long and include letters, numbers, and symbols (no spaces)."
      );
    }

    // 2. Check if passwords match
    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }

    // 3. Reserved admin email check
    if (email.toLowerCase() === "admin@ems.com") {
      errors.push("This email is reserved for system administration.");
    }

    // If any of the above failed, stop and render
    if (errors.length > 0) {
      return res.render("register", {
        error: errors,
        formData: { username, email },
      });
    }

    // 4. Check for existing email
    let existingUser = await userModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.render("register", {
        error: ["An account with this email already exists."],
        formData: { username, email },
      });
    }

    // 5. Proceed with registration
    const assignedRole =
      email.toLowerCase() === "admin@ems.com" ? "admin" : "user";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    let user = await userModel.create({
      username,
      email,
      password: hash,
      role: assignedRole,
    });

    let token = jwt.sign(
      { email: user.email, userId: user._id, role: user.role },
      "shhhhhhhhh"
    );
    res.cookie("token", token);

    req.flash("success", "Registration successful!");
    res.redirect("/login");
  } catch (err) {
    console.error("Registration Error:", err);
    res
      .status(500)
      .send("An unexpected error occurred. Please try again later.");
  }
};

exports.getLogin = (req, res) => {
  res.render("login");
};

exports.postLogin = async (req, res) => {
try{
  try {
    const { email, password } = req.body;
    const identifier = (email || "").trim().toLowerCase();

        if (!identifier || !password) {
            return res.render('login', {
                error: 'Please provide both email/username and password.',
                formData: { email: identifier }
            });
        }

        const query = identifier.includes("@")
            ? { email: identifier }
            : { username: identifier };

        const user = await userModel.findOne(query);

        if (!user) {
            return res.render('login', {
                error: 'Invalid Credentials',
                formData: { email: identifier }
            });
        }

        const looksHashed = typeof user.password === "string" && user.password.startsWith("$2");
        let isMatch = false;

        if (looksHashed) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // Legacy plaintext fallback: if matched, upgrade to bcrypt hash
            isMatch = password === user.password;
            if (isMatch) {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(password, salt);
                user.password = hash;
                await user.save();
            }
        }

        if (isMatch) {
            const token = jwt.sign(
                { email: user.email, userId: user._id, role: user.role },
                "shhhhhhhhh"
            );
            res.cookie("token", token);

            // THE REDIRECT LOGIC
            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            }
            return res.redirect('/user'); // Regular user landing page
        }

        return res.render('login', {
            error: 'Invalid Credentials',
            formData: { email: identifier }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.redirect('/login');
    }

    const query = identifier.includes("@")
      ? { email: identifier }
      : { username: identifier };

    const user = await userModel.findOne(query);

    if (!user) {
      return res.render("login", {
        error: "Invalid Credentials",
        formData: { email: identifier },
      });
    }

    const looksHashed =
      typeof user.password === "string" && user.password.startsWith("$2");
    let isMatch = false;

    if (looksHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plaintext fallback: if matched, upgrade to bcrypt hash
      isMatch = password === user.password;
      if (isMatch) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        user.password = hash;
        await user.save();
      }
    }

    if (isMatch) {
      const token = jwt.sign(
        { email: user.email, userId: user._id, role: user.role },
        "shhhhhhhhh"
      );
      res.cookie("token", token);

      // THE REDIRECT LOGIC
      if (user.role === "admin") {
        return res.redirect("/admin/dashboard");
      }
      return res.redirect("/catalog"); // Regular user landing page
    }

    return res.render("login", {
      error: "Invalid Credentials",
      formData: { email: identifier },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.redirect("/login");
  }
};


exports.getUserDashboard = async (req, res) => {
    try {
      const now = new Date();
      const user = await userModel.findById(req.user.userId);
  
      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/login");
      }
  
      const bookingModel = require("../models/bookingModel");
  
      const recentBookings = await bookingModel
        .find({
          userEmail: user.email,
          status: "confirmed",
        })
        .populate({
          path: "eventId",
          match: { date: { $gte: now } },
        })
        .sort({ createdAt: -1 });
  
      const allActiveBookings = recentBookings.filter((b) => b.eventId !== null);
      const topRecentBookings = allActiveBookings.slice(0, 5);
  
      const totalBookings = await bookingModel.countDocuments({
        userEmail: user.email,
        status: "confirmed",
      });
  
      const upcomingEvents = allActiveBookings.length;
  
      // Latest events - no date filter, just newest added
      const latestEvents = await eventModel
        .find({ status: { $ne: "cancelled" } })
        .sort({ createdAt: -1 })
        .limit(3);
  
      console.log("latestEvents found:", latestEvents.length, latestEvents.map(e => e.eventName));
  
      const notifications = Array.isArray(user.notifications) ? user.notifications : [];
  
      res.render("user", {
        user,
        recentBookings: topRecentBookings,
        totalBookings,
        upcomingEvents,
        latestEvents,
        notifications,
      });
    } catch (err) {
      console.error("Dashboard Error:", err);
      res.redirect("/login");
    }
  };

exports.cancelBooking = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    // 1. Get user to get email (for finding the specific booking)
    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (!Array.isArray(user.bookedEvents)) {
      user.bookedEvents = [];
    }

    // 2. Remove from user's bookedEvents array
    user.bookedEvents = user.bookedEvents.filter(
      (id) => id.toString() !== eventId
    );
    await user.save();

    // 3. Mark bookings as cancelled (keep record for history)
    const bookingModel = require("../models/bookingModel");
    const activeBookings = await bookingModel
      .find({
        eventId,
        userEmail: user.email,
        status: { $ne: "cancelled" },
      })
      .populate("eventId", "date");
    await syncBookingsExpiry(activeBookings);

    const cancellableBookings = activeBookings.filter((booking) => {
      const status = (booking.status || "").toLowerCase();
      return status !== "cancelled" && status !== "expired";
    });
    if (cancellableBookings.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This booking has expired and can no longer be cancelled.",
      });
    }

    const totalCancelled = cancellableBookings.reduce((sum, booking) => {
      const count = booking.ticketCount || 1;
      return sum + count;
    }, 0);

    await bookingModel.updateMany(
      { _id: { $in: cancellableBookings.map((booking) => booking._id) } },
      { $set: { status: "cancelled" } }
    );

    if (!Array.isArray(user.notifications)) {
      user.notifications = [];
    }
    if (totalCancelled > 0) {
      let eventName = "Event";
      try {
        const eventDoc = await eventModel
          .findById(eventId)
          .select("eventName title");
        if (eventDoc) {
          eventName = eventDoc.eventName || eventDoc.title || eventName;
        }
      } catch (err) {
        eventName = eventName;
      }
      user.notifications.unshift({
        type: "booking_cancelled",
        eventId,
        eventName,
        ticketCount: totalCancelled,
        createdAt: new Date(),
      });
      if (user.notifications.length > 20) {
        user.notifications = user.notifications.slice(0, 20);
      }
    }
    await user.save();

    res.json({ success: true, message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("Cancel Booking Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.cancelBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { cancelCount: cancelCountRaw } = req.body || {};
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid booking." });
    }

    const cancelCount = Math.max(1, parseInt(cancelCountRaw, 10) || 0);
    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (!Array.isArray(user.bookedEvents)) {
      user.bookedEvents = [];
    }

    const bookingModel = require("../models/bookingModel");
    const booking = await bookingModel
      .findById(bookingId)
      .populate("eventId", "date");
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    await syncBookingExpiry(booking);
    if (booking.userEmail !== user.email) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
      });
    }
    if (booking.status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Booking is already cancelled" });
    }
    if (booking.status === "expired") {
      return res.status(400).json({
        success: false,
        message: "Booking has expired and can no longer be cancelled",
      });
    }

    const currentCount = Math.max(booking.ticketCount || 1, 1);
    const normalizedCancel = Math.min(cancelCount, currentCount);

    let ticketCodes = Array.isArray(booking.ticketCodes)
      ? [...booking.ticketCodes]
      : [];
    const referenceNumber =
      booking.referenceNumber ||
      `EMS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (ticketCodes.length < currentCount) {
      for (let i = ticketCodes.length; i < currentCount; i += 1) {
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        ticketCodes.push(
          `${referenceNumber}-${String(i + 1).padStart(2, "0")}-${suffix}`
        );
      }
      booking.referenceNumber = referenceNumber;
      booking.bookingRef = booking.bookingRef || referenceNumber;
    }

    const isFullCancel = normalizedCancel >= currentCount;

    if (isFullCancel) {
      booking.status = "cancelled";
    } else {
      const remainingCount = currentCount - normalizedCancel;
      booking.ticketCount = remainingCount;
      booking.totalAmount = (booking.unitPrice || 0) * remainingCount;
      booking.ticketCodes = ticketCodes.slice(0, remainingCount);
    }

    await booking.save();

    if (!Array.isArray(user.notifications)) {
      user.notifications = [];
    }
    let eventName = "Event";
    try {
      const eventDoc = await eventModel
        .findById(booking.eventId)
        .select("eventName title");
      if (eventDoc) {
        eventName = eventDoc.eventName || eventDoc.title || eventName;
      }
    } catch (err) {
      eventName = eventName;
    }
    user.notifications.unshift({
      type: "booking_cancelled",
      eventId: booking.eventId,
      eventName,
      ticketCount: normalizedCancel,
      createdAt: new Date(),
    });
    if (user.notifications.length > 20) {
      user.notifications = user.notifications.slice(0, 20);
    }

    if (isFullCancel) {
      const remainingActive = await bookingModel.countDocuments({
        eventId: booking.eventId,
        userEmail: user.email,
        status: { $nin: ["cancelled", "expired"] },
      });
      if (remainingActive === 0) {
        user.bookedEvents = user.bookedEvents.filter(
          (id) => id.toString() !== booking.eventId.toString()
        );
        await user.save();
      } else {
        await user.save();
      }
    } else {
      await user.save();
    }

    res.json({
      success: true,
      message: isFullCancel
        ? "Booking cancelled successfully"
        : "Tickets cancelled successfully",
      status: booking.status,
      remainingTickets: isFullCancel ? 0 : booking.ticketCount,
    });
  } catch (err) {
    console.error("Cancel Booking (partial) Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getGuestDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events = await eventModel
      .find({ date: { $gte: today } })
      .populate("categoryId");
    res.render("index", { events: events, user: null });
  } catch (err) {
    res.status(500).send("Error loading dashboard");
  }
};

exports.getCatalog = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events = await eventModel
      .find({ date: { $gte: today } })
      .populate("categoryId");

    // Fetch the full user document if logged in; otherwise allow guest view
    let fullUser = null;
    if (!req.user) {
      const token = req.cookies && req.cookies.token;
      if (token) {
        try {
          const jwt = require("jsonwebtoken");
          req.user = jwt.verify(token, "shhhhhhhhh");
        } catch (err) {
          req.user = null;
        }
      }
    }

    if (req.user && req.user.userId) {
      fullUser = await userModel.findById(req.user.userId);
    }

    res.render("catalog", {
      events: events,
      user: fullUser, // Pass the full database object instead of just req.user
    });
  } catch (err) {
    console.error("Error loading catalog:", err);
    res.status(500).send("Error loading catalog");
  }
};

exports.searchEvents = async (req, res) => {
  try {
    let { q, date, category } = req.query;
    let queryObj = {};

    // 1. Text Search (Matches eventName regardless of case)
    if (q) {
      queryObj.eventName = { $regex: q, $options: "i" };
    }

    // 2. Date Search
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(date);
      nextDay.setDate(searchDate.getDate() + 1);

      queryObj.date = {
        $gte: searchDate,
        $lt: nextDay,
      };
    }

    // 3. Category Filter
    if (category && category !== "All") {
      // Find the category ID first
      const catDoc = await categoryModel.findOne({ name: category });
      if (catDoc) {
        queryObj.categoryId = catDoc._id;
      }
    }

    // Ensure we only show future events for general search unless a specific date is requested
    if (!date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      queryObj.date = { $gte: today };
    }

    // Fetch events from DB and populate categoryId
    const events = await eventModel.find(queryObj).populate("categoryId");

    // Render the page with the found events
    res.render("index", { events: events });
  } catch (err) {
    console.error("Search failed:", err);
    res.status(500).send("Search failed");
  }
};

// Add this to your userController.js
exports.getProfile = async (req, res) => {
  try {
    // req.user.userId comes from your auth middleware
    const user = await userModel.findById(req.user.userId);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/login");
    }

    // Render profile.ejs and pass the user object
    res.render("profile", { user });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).send("Internal Server Error");
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "New passwords do not match." });
    }

    const user = await userModel.findById(req.user.userId);

    // 1. Verify the OLD password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Current password is incorrect." });
    }

    // 2. Hash the NEW password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // 3. Update the database
    user.password = newHash;
    await user.save();

    res.json({ message: "Password updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during password update." });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // The path we store in the DB (relative to the 'public' folder)
    const imagePath = `/images/uploads/${req.file.filename}`;

    await userModel.findByIdAndUpdate(req.user.userId, {
      profileImage: imagePath,
    });

    res.json({
      message: "Avatar updated successfully!",
      imagePath: imagePath,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving avatar" });
  }
};

exports.updateProfileInfo = async (req, res) => {
  try {
    const { removeProfileImage } = req.body;
    const updateData = {};

    // 1. Handle Image logic
    if (removeProfileImage === "true") {
      // Set back to your DB default or an empty string
      updateData.profileImage = "https://tinyurl.com/3jjyxzj6";
    } else if (req.file) {
      // req.file is populated by upload.single('avatar')
      updateData.profileImage = `/images/uploads/${req.file.filename}`;
    }

    // 2. Update DB
    const updatedUser = await userModel.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true }
    );

    res.json({
      message: "Profile updated successfully!",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating profile." });
  }
};

exports.logout = (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
};
