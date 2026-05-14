const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userModel = require("../models/user");
const eventModel = require("../models/event");
const categoryModel = require("../models/categoryModel");
const mongoose = require("mongoose");
const EmailVerification = require("../models/emailVerification");
const emailService = require("../utils/emailService");
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
    username = (username || "").trim().toLowerCase();
    email = (email || "").trim().toLowerCase();
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

    // 4. Check for existing email or username
    const existingUser = await userModel.findOne({
      $or: [
        { email: email },
        { username: username }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "username";
      return res.render("register", {
        error: [`An account with this ${field} already exists.`],
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

exports.getResetPassword = (req, res) => {
  res.render("reset-password");
};

exports.postLogin = async (req, res) => {
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
            // Legacy plaintext fallback
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

            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            }
            return res.redirect('/user');
        }

        return res.render('login', {
            error: 'Invalid Credentials',
            formData: { email: identifier }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.render('login', { error: 'An internal error occurred. Please try again.' });
    }
};

exports.getUserDashboard = async (req, res) => {
    try {
        const now = new Date();
        const user = await userModel.findById(req.user.userId);

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }

        const bookingModel = require("../models/bookingModel");
        
        // Fetch recent confirmed bookings for future events
        const recentBookings = await bookingModel.find({
            userEmail: user.email,
            status: 'confirmed'
        })
        .populate({
            path: 'eventId',
            match: { endDate: { $gte: now } }
        })
        .sort({ createdAt: -1 });
  
      const allActiveBookings = recentBookings.filter((b) => b.eventId !== null);
      const topRecentBookings = allActiveBookings.slice(0, 3);
  
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

exports.loadMoreBookings = async (req, res) => {
  try {
    const { skip } = req.query;
    const skipCount = parseInt(skip) || 0;
    const user = await userModel.findById(req.user.userId);
    const bookingModel = require("../models/bookingModel");
    
    const bookings = await bookingModel
      .find({ userEmail: user.email })
      .populate("eventId")
      .sort({ createdAt: -1 })
      .skip(skipCount)
      .limit(5);
      
    const validBookings = bookings.filter(b => b.eventId !== null).map(b => ({
      _id: b._id,
      status: b.status || 'confirmed',
      eventImage: b.eventId.image || b.eventId.imagePath,
      eventName: b.eventId.eventName || b.eventId.title,
      eventLocation: b.eventId.location,
      eventDate: b.eventId.date,
      eventStartDate: b.eventId.startDate // in case the UI uses startDate
    }));
    
    res.json({ success: true, bookings: validBookings });
  } catch (err) {
    console.error("Error fetching more bookings:", err);
    res.status(500).json({ success: false });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    // 1. Get user to get email (for finding the specific booking)
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (!Array.isArray(user.bookedEvents)) {
      user.bookedEvents = [];
    }

    // 2. Remove from user's bookedEvents array
    user.bookedEvents = user.bookedEvents.filter((id) => id.toString() !== eventId);
    await user.save();

    // 3. Mark bookings as cancelled (keep record for history)
    const bookingModel = require("../models/bookingModel");
    const activeBookings = await bookingModel
      .find({
        eventId,
        userEmail: user.email,
        status: { $ne: "cancelled" },
      })
      .populate("eventId", "startDate");
    
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
        console.error("Error fetching event name for notification:", err);
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
      await user.save();
    }

    res.json({ success: true, message: "Booking cancelled successfully" });
  } catch (err) {
    console.error("Cancel Booking Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};


exports.cancelBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { cancelCount: cancelCountRaw } = req.body || {};
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking." });
    }

    const cancelCount = Math.max(1, parseInt(cancelCountRaw, 10) || 0);
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const bookingModel = require("../models/bookingModel");
    const booking = await bookingModel.findById(bookingId).populate("eventId", "startDate");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    await syncBookingExpiry(booking);
    if (booking.userEmail !== user.email) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }
    if (booking.status === "expired") {
      return res.status(400).json({
        success: false,
        message: "Booking has expired and can no longer be cancelled",
      });
    }

    const currentCount = Math.max(booking.ticketCount || 1, 1);
    const normalizedCancel = Math.min(cancelCount, currentCount);

    let ticketCodes = Array.isArray(booking.ticketCodes) ? [...booking.ticketCodes] : [];
    let attendeeNames = Array.isArray(booking.attendeeNames) ? [...booking.attendeeNames] : [];
    const referenceNumber = booking.referenceNumber || `EMS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (ticketCodes.length < currentCount) {
      for (let i = ticketCodes.length; i < currentCount; i += 1) {
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        ticketCodes.push(`${referenceNumber}-${String(i + 1).padStart(2, "0")}-${suffix}`);
      }
      booking.referenceNumber = referenceNumber;
      booking.bookingRef = booking.bookingRef || referenceNumber;
    }

    const isFullCancel = normalizedCancel >= currentCount;

    if (isFullCancel) {
      booking.status = "cancelled";
    } else {
      const remainingCount = currentCount - normalizedCancel;
      const cancelledCodes = ticketCodes.slice(remainingCount, remainingCount + normalizedCancel);
      const cancelledNames = attendeeNames.slice(remainingCount, remainingCount + normalizedCancel);
      
      booking.ticketCount = remainingCount;
      booking.totalAmount = (booking.unitPrice || 0) * remainingCount;
      booking.ticketCodes = ticketCodes.slice(0, remainingCount);
      booking.attendeeNames = attendeeNames.slice(0, remainingCount);

      // Create a separate cancelled-history record
      const cancellationRef = `EMS-CAN-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      try {
        await bookingModel.create({
          eventId: booking.eventId,
          userName: cancelledNames[0] || booking.userName,
          userEmail: booking.userEmail,
          attendeeEmail: booking.attendeeEmail || booking.userEmail,
          attendeeNames: cancelledNames,
          ticketCount: normalizedCancel,
          unitPrice: booking.unitPrice || 0,
          totalAmount: (booking.unitPrice || 0) * normalizedCancel,
          ticketCodes: cancelledCodes,
          referenceNumber: cancellationRef,
          bookingRef: cancellationRef,
          status: "cancelled",
        });
      } catch (err) {
        console.error("Cancel history insert failed:", err);
      }
    }

    await booking.save();

    // Handle user notifications
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
      console.error("Error fetching event name for notification:", err);
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
      }
    }
    await user.save();

    res.json({
      success: true,
      message: isFullCancel ? "Booking cancelled successfully" : "Tickets cancelled successfully",
      status: booking.status,
      remainingTickets: isFullCancel ? 0 : booking.ticketCount,
    });
  } catch (err) {
    console.error("Cancel Booking (partial) Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};


exports.getGuestDashboard = async (req, res) => {
    try {
        const { hasEventEnded } = require("../utils/bookingStatus");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch events where endDate is today or in the future
        let events = await eventModel.find({ 
            endDate: { $gte: today },
            status: { $ne: 'cancelled' }
        }).populate('categoryId').lean();

        // Filter out events that have precisely ended (date + time)
        events = events.filter(event => !hasEventEnded(event));

        res.render("index", { events: events, user: null });
    } catch (err) {
        console.error("Error loading guest dashboard:", err);
        res.status(500).send("Error loading dashboard");
    }
};

exports.getCatalog = async (req, res) => {
    try {
        const { hasEventEnded } = require("../utils/bookingStatus");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch events where endDate is today or in the future
        let events = await eventModel.find({ 
            endDate: { $gte: today },
            status: { $ne: 'cancelled' }
        }).populate('categoryId').lean();

        // Filter out events that have already ended precisely (date + time)
        events = events.filter(event => !hasEventEnded(event));

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
        const { hasEventEnded } = require("../utils/bookingStatus");
        let { q, date, category } = req.query;
        let queryObj = {
            status: { $ne: 'cancelled' }
        };

        // 1. Text Search (Title + Category)
        if (q) {
            const matchingCategories = await categoryModel.find({ 
                name: { $regex: q, $options: "i" } 
            });
            const categoryIds = matchingCategories.map(cat => cat._id);

            queryObj.$or = [
                { eventName: { $regex: q, $options: "i" } },
                { title: { $regex: q, $options: "i" } }, // Fallback for 'title' field
                { categoryId: { $in: categoryIds } }
            ];
        }

        // 2. Date Search
        if (date) {
            const searchDate = new Date(date);
            const nextDay = new Date(date);
            nextDay.setDate(searchDate.getDate() + 1);
            
            // If we have other conditions, we use $and to combine them with the date range
            const dateQuery = {
                $or: [
                    { startDate: { $gte: searchDate, $lt: nextDay } },
                    { endDate: { $gte: searchDate, $lt: nextDay } },
                    { date: { $gte: searchDate, $lt: nextDay } } // Fallback for 'date' field
                ]
            };

            if (queryObj.$or) {
                // If text search already added an $or, we use $and to group them
                const textSearchOr = queryObj.$or;
                delete queryObj.$or;
                queryObj.$and = [
                    { $or: textSearchOr },
                    dateQuery
                ];
            } else {
                queryObj.$or = dateQuery.$or;
            }
        }

        // 3. Category Filter (Dropdown)
        if (category && category !== "All") {
            const catDoc = await categoryModel.findOne({ name: category });
            if (catDoc) {
                queryObj.categoryId = catDoc._id;
            }
        }

        // 4. Future Events Filter
        if (!date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            queryObj.$and = queryObj.$and || [];
            queryObj.$and.push({
                $or: [
                    { endDate: { $gte: today } },
                    { date: { $gte: today } }
                ]
            });
            
            // Clean up $and if it only has one element and no other top-level fields depend on it
            if (queryObj.$and.length === 1 && !queryObj.$or) {
                const singleFilter = queryObj.$and[0];
                delete queryObj.$and;
                Object.assign(queryObj, singleFilter);
            }
        }

        // Fetch events from DB and populate categoryId
        let events = await eventModel.find(queryObj).populate('categoryId').lean();

        // Filter out events that have precisely ended (date + time)
        events = events.filter(event => !hasEventEnded(event));

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

// --- PASSWORD RESET FLOW ---

// 1. Forgot Password - Render Email Entry Page
exports.getForgotPassword = (req, res) => {
    res.render("reset-password");
};

// 2. Forgot Password - Handle Email Submission & Send Code
exports.postForgotPassword = async (req, res) => {
    try {
        let { email } = req.body;
        email = (email || "").trim().toLowerCase();
        console.log(`Password reset requested for: '${email}'`);

        const user = await userModel.findOne({ email: email });

        if (!user) {
            console.log(`User not found for email: '${email}'`);
            req.flash('error', 'No account found with that email address.');
            return res.redirect('/reset-password');
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log(`Generated code ${code} for ${email}, expires at ${expiresAt}`);

        // Invalidate previous codes for this email
        await EmailVerification.deleteMany({ email: email.toLowerCase() });

        // Save new code
        await EmailVerification.create({
            email: email.toLowerCase(),
            code,
            expiresAt
        });
        console.log(`Code saved to database for ${email}`);

        // Send email
        const emailResult = await emailService.sendResetCode(email, code);

        if (!emailResult.success) {
            console.error(`Failed to send email to ${email}:`, emailResult.error);
            req.flash('error', 'Failed to send verification email. Please try again.');
            return res.redirect('/reset-password');
        }

        console.log(`Email sent successfully to ${email}`);

        // Store email in session for the next steps
        req.session.resetEmail = email.toLowerCase();
        
        req.flash('success', 'Verification code sent to your email.');
        res.redirect('/verify-code');
    } catch (err) {
        console.error('Forgot Password Error:', err);
        req.flash('error', 'An unexpected error occurred. Please try again.');
        res.redirect('/reset-password');
    }
};

// 3. Verify Code - Render Page
exports.getVerifyCode = (req, res) => {
    if (!req.session.resetEmail) {
        return res.redirect('/reset-password');
    }
    res.render("verify-code", { 
        email: req.session.resetEmail
    });
};

// 4. Verify Code - Handle Submission
exports.postVerifyCode = async (req, res) => {
    try {
        const { code } = req.body;
        const email = req.session.resetEmail;

        if (!email) {
            return res.redirect('/reset-password');
        }

        const verification = await EmailVerification.findOne({
            email,
            code,
            expiresAt: { $gt: new Date() },
            used: false
        });

        if (!verification) {
            req.flash('error', 'Invalid or expired verification code.');
            return res.redirect('/verify-code');
        }

        // Mark code as "verified" in session (but not used yet until password is set)
        req.session.codeVerified = true;
        
        res.redirect('/create-password');
    } catch (err) {
        console.error('Verify Code Error:', err);
        req.flash('error', 'An error occurred during verification.');
        res.redirect('/verify-code');
    }
};

// 5. Create Password - Render Page
exports.getCreatePassword = (req, res) => {
    if (!req.session.resetEmail || !req.session.codeVerified) {
        return res.redirect('/reset-password');
    }
    res.render("create-password");
};

// 6. Create Password - Handle Submission
exports.postCreatePassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const email = req.session.resetEmail;

        if (!email || !req.session.codeVerified) {
            return res.redirect('/reset-password');
        }

        // Validation
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])(?!.*\s).{8,}$/;
        if (!passwordRegex.test(password)) {
            req.flash('error', 'Password must be at least 8 characters long and include letters, numbers, and symbols.');
            return res.redirect('/create-password');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/create-password');
        }

        // Update user password
        const user = await userModel.findOne({ email });
        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/reset-password');
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        user.password = hash;
        await user.save();

        // Invalidate the code
        await EmailVerification.updateOne({ email, used: false }, { used: true });

        // Clear session
        delete req.session.resetEmail;
        delete req.session.codeVerified;

        req.flash('success', 'Password reset successful! You can now login with your new password.');
        res.redirect('/login');
    } catch (err) {
        console.error('Create Password Error:', err);
        req.flash('error', 'Failed to update password. Please try again.');
        res.redirect('/create-password');
    }
};
