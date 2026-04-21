const express = require("express");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const eventRoutes = require('./routes/eventRoutes');

// 🔐 your additions
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");

// routes
const indexRouter = require('./routes/index');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔐 auth-related middlewares (your part)
app.use(cookieParser());

app.use(
    session({
        secret: "ems-secret",
        resave: false,
        saveUninitialized: false,
    })
);

app.use(flash());

// make user, notifications, and flash available in views
app.use(async (req, res, next) => {
    const jwt = require('jsonwebtoken');
    const token = req.cookies.token;
    res.locals.user = null;
    if (token) {
        try {
            res.locals.user = jwt.verify(token, "shhhhhhhhh");
            req.user = res.locals.user; // Ensure req.user is populated for controllers
        } catch (err) {
            res.locals.user = null;
            req.user = null;
        }
    }

    res.locals.notifications = [];
    if (res.locals.user && res.locals.user.userId) {
        try {
            const User = require("./models/user");
            const Booking = require("./models/bookingModel");
            const userDoc = await User.findById(res.locals.user.userId).select("notifications email profileImage username");
            if (userDoc) {
                // Attach real DB data back to the local user object
                res.locals.user.profileImage = userDoc.profileImage;
                res.locals.user.username = userDoc.username;
            }
            if (userDoc && Array.isArray(userDoc.notifications) && userDoc.notifications.length > 0) {
                res.locals.notifications = userDoc.notifications
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5);
            } else if (userDoc && userDoc.email) {
                const recentBookings = await Booking.find({ userEmail: userDoc.email })
                    .populate("eventId")
                    .sort({ createdAt: -1 })
                    .limit(5);
                const fallbackNotifications = recentBookings.map(booking => ({
                    type: booking.status === "cancelled" ? "booking_cancelled" : "booking_confirmed",
                    eventId: booking.eventId ? booking.eventId._id : booking.eventId,
                    eventName: booking.eventId
                        ? (booking.eventId.eventName || booking.eventId.title || "Event")
                        : "Event",
                    ticketCount: booking.ticketCount || 1,
                    createdAt: booking.createdAt
                }));
                res.locals.notifications = fallbackNotifications;
                if (fallbackNotifications.length > 0) {
                    userDoc.notifications = fallbackNotifications;
                    await userDoc.save();
                }
            }
        } catch (err) {
            res.locals.notifications = [];
        }
    }

    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

// Routes
app.use('/', indexRouter);
app.use('/admin', adminRoutes);
app.use('/event', eventRoutes);

// Example for future routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render("404", { title: "404 - Page Not Found" });
});

module.exports = app;
