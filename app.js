const express = require("express");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

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

// make user and flash available in views
app.use((req, res, next) => {
    const jwt = require('jsonwebtoken');
    const token = req.cookies.token;
    if (token) {
        try {
            res.locals.user = jwt.verify(token, "shhhhhhhhh");
        } catch (err) {
            res.locals.user = null;
        }
    } else {
        res.locals.user = null;
    }
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

// Routes
app.use('/', indexRouter);
app.use('/admin', adminRoutes);

// Example for future routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render("404", { title: "404 - Page Not Found" });
});

module.exports = app;


