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

// Routes - Demo pages for My Bookings + Manage Booking
const Booking = require('./models/bookingModel');
const userModel = require('./models/user');
const Event = require('./models/eventModel');

// Sample data
const sampleEvents = [
    {
        name: 'Global Design Summit 2026',
        description: 'A curated summit exploring future-facing design systems, material innovation, and human-centric architecture.',
        date: new Date('2026-11-14'),
        time: '18:30',
        location: 'The Glass Pavilion, NYC',
        category: 'Design',
        ticketPrice: 120,
        maxCapacity: 400,
        tier: 'Reserved',
        currentBookings: 1,
        status: 'active'
    },
    {
        name: 'Architectural Biennale',
        description: 'A modernist showcase celebrating boundary-pushing spatial narratives and immersive installations.',
        date: new Date('2026-12-02'),
        time: '19:00',
        location: 'Modernist Wing, London',
        category: 'Architecture',
        ticketPrice: 95,
        maxCapacity: 350,
        tier: 'Premium',
        currentBookings: 1,
        status: 'active'
    },
    {
        name: "The Curator's Gala",
        description: 'An elegant evening honoring curators and collectors shaping contemporary art across the globe.',
        date: new Date('2026-12-15'),
        time: '20:00',
        location: 'Royal Botanical Gardens',
        category: 'Art',
        ticketPrice: 150,
        maxCapacity: 300,
        tier: 'Front Row',
        currentBookings: 1,
        status: 'active'
    }
];

const sampleUser = {
    username: 'hello',
    email: 'hello@gmail.com',
    password: 'hashed_password_here'
};

async function ensureDemoData() {
    let user = await userModel.findOne();
    if (!user) {
        user = await userModel.create(sampleUser);
    }

    const existingBookings = await Booking.find({ user: user._id });
    if (existingBookings.length === 0) {
        for (const data of sampleEvents) {
            let event = await Event.findOne({ name: data.name });
            if (!event) {
                event = await Event.create(data);
            }
            await Booking.create({
                user: user._id,
                event: event._id,
                amount: event.ticketPrice,
                status: 'confirmed'
            });
        }
    }

    return user;
}

async function renderMyBookings(req, res) {
    try {
        const user = await ensureDemoData();
        let bookings = await Booking.find({ user: user._id })
            .populate('event')
            .sort({ createdAt: -1 });

        return res.render('myBookings', { bookings, user, error: [] });
    } catch (err) {
        console.error('My bookings error:', err);
        return res.status(500).send('Server Error: ' + err.message);
    }
}

app.get('/', renderMyBookings);
app.get('/bookings/my-bookings', renderMyBookings);

app.get('/bookings/manage/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('event');
        if (!booking) {
            return res.redirect('/bookings/my-bookings');
        }

        let user = await userModel.findById(booking.user);
        if (!user) {
            user = sampleUser;
        }

        return res.render('manageBooking', { booking, user, error: [] });
    } catch (err) {
        console.error('Manage booking error:', err);
        return res.status(500).send('Server Error: ' + err.message);
    }
});

// Cancel booking (no auth for demo mode)
app.post('/bookings/cancel/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('event');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'This booking is already cancelled.' });
        }

        booking.status = 'cancelled';
        await booking.save();

        if (booking.event && booking.event.currentBookings > 0) {
            await Event.findByIdAndUpdate(booking.event._id, {
                $inc: { currentBookings: -1 }
            });
        }

        return res.status(200).json({ success: true, message: 'Booking cancelled successfully.' });
    } catch (err) {
        console.error('Cancel booking error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});


// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

module.exports = app;
