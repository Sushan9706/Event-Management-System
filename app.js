const express = require("express");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const eventRoutes = require("./routes/eventRoutes");

// 🔐 your additions
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");

// routes
const indexRouter = require("./routes/index");
const adminRoutes = require("./routes/adminRoutes");
const User = require("./models/user");
const Booking = require("./models/bookingModel");

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
  const jwt = require("jsonwebtoken");
  const token = req.cookies.token;
  res.locals.user = null;
  res.locals.notifications = [];

  if (token) {
    try {
      const decoded = jwt.verify(token, "shhhhhhhhh");
      req.user = decoded;
      res.locals.user = decoded;

      // Fetch user data for the navbar/sidebar (cached in res.locals)
      const userDoc = await User.findById(decoded.userId).select(
        "notifications email profileImage username bookedEvents"
      ).lean(); // Use lean() for better performance as we don't need Mongoose methods here

      if (userDoc) {
        // Merge DB data into res.locals.user
        Object.assign(res.locals.user, {
            email: userDoc.email,
            profileImage: userDoc.profileImage,
            username: userDoc.username,
            bookedEvents: userDoc.bookedEvents
        });

        // Set notifications from user doc
        if (Array.isArray(userDoc.notifications)) {
          res.locals.notifications = userDoc.notifications
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
        }
      }
    } catch (err) {
      console.error("Auth Middleware Error:", err);
      res.locals.user = null;
      req.user = null;
    }
  }

  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

// Routes
app.use("/", indexRouter);
app.use("/admin", adminRoutes);
app.use("/event", eventRoutes);

// Example for future routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - Page Not Found" });
});

module.exports = app;
