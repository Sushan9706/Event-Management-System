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
  if (token) {
    try {
      const decoded = jwt.verify(token, "shhhhhhhhh");
      res.locals.user = decoded;
      req.user = decoded;
    } catch (err) {
      res.locals.user = null;
      req.user = null;
    }
  }

  res.locals.notifications = [];
  if (res.locals.user && res.locals.user.userId) {
    try {
      const User = require("./models/user");
      const userDoc = await User.findById(res.locals.user.userId).select(
        "notifications email profileImage username bookedEvents"
      );
      if (userDoc) {
        res.locals.user.email = userDoc.email;
        res.locals.user.profileImage = userDoc.profileImage;
        res.locals.user.username = userDoc.username;
        res.locals.user.bookedEvents = userDoc.bookedEvents;
        if (
          Array.isArray(userDoc.notifications) &&
          userDoc.notifications.length > 0
        ) {
          res.locals.notifications = userDoc.notifications
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);
        }
      }
    } catch (err) {
      res.locals.notifications = [];
    }
  }

  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

// Mark single notification as read
// Mark single notification as read
app.post("/notifications/mark-as-read/:id", async (req, res) => {
  const jwt = require("jsonwebtoken");
  const User = require("./models/user");
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ success: false });
  try {
    const decoded = jwt.verify(token, "shhhhhhhhh");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false });
    const notif = user.notifications.id(req.params.id);
    if (notif) {
      notif.isRead = true;
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Mark all notifications as read
app.post("/notifications/mark-all-read", async (req, res) => {
  const jwt = require("jsonwebtoken");
  const User = require("./models/user");
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ success: false });
  try {
    const decoded = jwt.verify(token, "shhhhhhhhh");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false });
    user.notifications.forEach((n) => {
      n.isRead = true;
    });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
// Routes (Updated: 2026-05-12)
console.log("Initializing Index Router...");
app.use("/", indexRouter);
app.use("/admin", adminRoutes);
app.use("/event", eventRoutes);
app.use("/venues", require("./routes/venuesRoutes"));

// Example for future routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/auth', authRoutes);

app.get("/test-route", (req, res) => res.send("Router is working!"));


// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - Page Not Found" });
});
console.log(
  app._router.stack.map((r) => r.route && r.route.path).filter(Boolean)
);
console.log(
  app._router.stack.map((r) => r.route && r.route.path).filter(Boolean)
);

module.exports = app;
