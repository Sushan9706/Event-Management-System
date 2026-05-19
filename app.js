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
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ems_token";

const app = express();

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Enforce a single global font across all rendered pages (user + admin).
app.use((req, res, next) => {
  const originalRender = res.render.bind(res);
  const fontOverrideStyle =
    '<style id="global-font-override">*,*::before,*::after{font-family:sans-serif !important;}.fa,.fa-solid,.fa-regular,.fa-brands,.fas,.far,.fab,[class*="fa-"]::before,[class*="fa-"]::after{font-family:"Font Awesome 6 Free","Font Awesome 6 Brands","FontAwesome" !important;}</style>';

  res.render = (view, options, callback) => {
    let renderOptions = options;
    let renderCallback = callback;

    if (typeof renderOptions === "function") {
      renderCallback = renderOptions;
      renderOptions = {};
    }

    const injectOverride = (html) => {
      if (typeof html !== "string") return html;
      if (html.includes('id="global-font-override"')) return html;
      return html.replace(/<\/head>/i, `${fontOverrideStyle}</head>`);
    };

    if (typeof renderCallback === "function") {
      return originalRender(view, renderOptions, (err, html) => {
        if (err) return renderCallback(err);
        return renderCallback(null, injectOverride(html));
      });
    }

    return originalRender(view, renderOptions, (err, html) => {
      if (err) return next(err);
      return res.send(injectOverride(html));
    });
  };

  next();
});

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
  const token = req.cookies[AUTH_COOKIE_NAME] || req.cookies.token;
  res.locals.user = null;
  res.locals.notifications = [];
  res.locals.apiToken = "";

  if (token) {
    try {
      const decoded = jwt.verify(token, "shhhhhhhhh");
      req.user = decoded;
      res.locals.user = decoded;
      // Dedicated API token avoids cookie collision issues on localhost multi-app setups.
      res.locals.apiToken = jwt.sign(
        { email: decoded.email, userId: decoded.userId, role: decoded.role, source: "web" },
        "shhhhhhhhh",
        { expiresIn: "2h" }
      );

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
  res.locals.path = req.path.replace(/\/$/, "") || "/";
  next();
});

// Routes
app.use("/", indexRouter);
app.use("/admin", adminRoutes);
app.use("/event", eventRoutes);
app.use("/venue", require("./routes/venueRoutes"));

// Example for future routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - Page Not Found" });
});

module.exports = app;
