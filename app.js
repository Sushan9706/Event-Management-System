const express = require("express");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

// 🔐 your additions
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");

// routes
const indexRouter = require("./routes/index");

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

// make flash available in views
app.use((req, res, next) => {
  res.locals.error = req.flash("error");
  next();
});

// Routes
app.use("/", indexRouter);

// Example for future routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - Page Not Found" });
});

module.exports = app;

const express = require("express");
const path = require("path");

const PORT = 3000;

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/guest", (req, res) => {
  res.render("guest");
});

app.get("/user", (req, res) => {
  res.render("user");
});

app.get("/event", (req, res) => {
  res.render("event");
});

app.get("/catalog", (req, res) => {
  res.render("catalog");
});
app.get("/bookings", (req, res) => {
  res.render("bookings");
});

app.get("/profile", (req, res) => {
  res.render("profile");
});
app.get("/profile", (req, res) => {
  res.render("profile");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/eventcreat", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
