const express = require('express');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Main route
app.get('/', (req, res) => {
    res.render('index', { title: 'Event Management System - Home' });
});

// Import and use routes (placeholders)
// const eventRoutes = require('./routes/eventRoutes');
// app.use('/events', eventRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

module.exports = app;
