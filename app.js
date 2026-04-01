const express = require('express');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
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

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/eventManagement')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes - Manage Booking Page Only
const Booking = require('./models/bookingModel');
const userModel = require('./models/user');
const Event = require('./models/eventModel');

// Sample data
const sampleEvent = {
    name: 'Noir Architectural Symposium',
    description: 'An evening dedicated to the exploration of monochromatic silhouettes in modern architecture. The Noir Architectural Symposium brings together the continent\'s most influential structural designers for a night of curated dialogue at Berlin\'s iconic Concrete Atrium.',
    date: new Date('2026-03-14'),
    time: '19:00 — 22:30 CET',
    location: 'The Concrete Atrium, Berlin',
    category: 'Architecture',
    ticketPrice: 150,
    maxCapacity: 500,
    tier: 'Front Row Circle',
    currentBookings: 1,
    status: 'active'
};

const sampleUser = {
    username: 'Alexander Sterling',
    email: 'a.sterling@ems.com',
    password: 'hashed_password_here'
};

app.get('/', async (req, res) => {
    try {
        // Get first booking from database
        let booking = await Booking.findOne().populate('event');
        
        // If no booking exists, create sample data
        if (!booking) {
            // Find or create event
            let event = await Event.findOne();
            if (!event) {
                event = await Event.create(sampleEvent);
            }
            
            // Find or create user
            let user = await userModel.findOne();
            if (!user) {
                user = await userModel.create(sampleUser);
            }
            
            // Create booking
            booking = await Booking.create({
                user: user._id,
                event: event._id,
                amount: event.ticketPrice,
                status: 'confirmed'
            });
            
            booking = await booking.populate('event');
        }

        // Get user data
        let user = await userModel.findById(booking.user);
        if (!user) {
            user = sampleUser;
        }
        
        return res.render('manageBooking', { booking, user, error: [] });
    } catch (err) {
        console.error('Route error:', err);
        console.error('Full error stack:', err.stack);
        return res.status(500).send('Server Error: ' + err.message);
    }
});


// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

module.exports = app;
