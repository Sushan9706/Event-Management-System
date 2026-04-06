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

// Sample data (seeded into MongoDB so Manage works with real IDs)
const sampleEvents = [
    {
        name: 'Kathmandu Jazz Night',
        description: 'An intimate live jazz session featuring local legends and modern improvisations.',
        date: new Date('2026-04-12'),
        time: '07:30 PM',
        location: 'Jazz Upstairs, Kathmandu',
        category: 'Music',
        ticketPrice: 35,
        maxCapacity: 180,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-jazz/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Startup Expo 2026',
        description: 'A one-day expo showcasing Nepal’s most promising startups, demos, and investor sessions.',
        date: new Date('2026-04-18'),
        time: '10:00 AM',
        location: 'Bhrikutimandap, Kathmandu',
        category: 'Tech',
        ticketPrice: 20,
        maxCapacity: 500,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-startup/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Himalayan Food Fest',
        description: 'Street food, regional specialties, and live cooking stations from across the Himalayas.',
        date: new Date('2026-04-22'),
        time: '04:00 PM',
        location: 'Tundikhel, Kathmandu',
        category: 'Festival',
        ticketPrice: 10,
        maxCapacity: 800,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-food/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Everest Trail Photo Walk',
        description: 'Golden-hour photo walk with a local guide, perfect for landscape and street photography.',
        date: new Date('2026-04-27'),
        time: '06:00 AM',
        location: 'Thamel, Kathmandu',
        category: 'Photography',
        ticketPrice: 15,
        maxCapacity: 60,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-photo/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Pokhara Lakeside Yoga Retreat',
        description: 'Morning flow sessions by Phewa Lake with a calm, scenic view and guided breathing.',
        date: new Date('2026-05-03'),
        time: '07:00 AM',
        location: 'Lakeside, Pokhara',
        category: 'Wellness',
        ticketPrice: 25,
        maxCapacity: 120,
        tier: 'Premium',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-yoga/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Nepali Film Premiere: Everest Dawn',
        description: 'Red-carpet premiere of a new Nepali feature film with cast and director Q&A.',
        date: new Date('2026-05-09'),
        time: '07:00 PM',
        location: 'QFX Civil Mall, Kathmandu',
        category: 'Film',
        ticketPrice: 18,
        maxCapacity: 250,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-film/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Tech Meetup: Cloud & AI',
        description: 'Lightning talks and networking on cloud architecture, AI tooling, and local use cases.',
        date: new Date('2026-05-16'),
        time: '05:30 PM',
        location: 'Lalitpur Hub',
        category: 'Tech',
        ticketPrice: 0,
        maxCapacity: 200,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-tech/900/600',
        bookingStatus: 'confirmed'
    },
    {
        name: 'Monsoon Art Market',
        description: 'A curated market of painters, ceramicists, and textile artists from the valley.',
        date: new Date('2026-05-20'),
        time: '03:00 PM',
        location: 'Patan Durbar Square',
        category: 'Art',
        ticketPrice: 12,
        maxCapacity: 300,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-art/900/600',
        bookingStatus: 'cancelled'
    },
    {
        name: 'Heritage Cycling Tour',
        description: 'A guided early-morning cycling tour through Bhaktapur’s heritage lanes.',
        date: new Date('2026-05-24'),
        time: '06:00 AM',
        location: 'Bhaktapur Durbar Square',
        category: 'Outdoor',
        ticketPrice: 22,
        maxCapacity: 90,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-cycle/900/600',
        bookingStatus: 'cancelled'
    },
    {
        name: 'Acoustic Rooftop Sessions',
        description: 'Sunset acoustic sets with a rooftop view and curated refreshments.',
        date: new Date('2026-05-28'),
        time: '08:00 PM',
        location: 'Lazimpat, Kathmandu',
        category: 'Music',
        ticketPrice: 15,
        maxCapacity: 120,
        tier: 'Standard',
        status: 'active',
        image: 'https://picsum.photos/seed/ems-acoustic/900/600',
        bookingStatus: 'cancelled'
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

    for (const data of sampleEvents) {
        const { bookingStatus, ...eventData } = data;
        let event = await Event.findOne({ name: eventData.name });
        if (!event) {
            event = await Event.create({
                ...eventData,
                currentBookings: bookingStatus === 'confirmed' ? 1 : 0
            });
        } else if (!event.image && eventData.image) {
            event.image = eventData.image;
            await event.save();
        }

        const existingBooking = await Booking.findOne({ user: user._id, event: event._id });
        if (!existingBooking) {
            await Booking.create({
                user: user._id,
                event: event._id,
                amount: event.ticketPrice,
                status: bookingStatus
            });

            if (bookingStatus === 'confirmed' && event.currentBookings === 0) {
                event.currentBookings = 1;
                await event.save();
            }
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
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.redirect('/bookings/my-bookings');
        }

        const booking = await Booking.findById(bookingId).populate('event');
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
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking reference.' });
        }

        const booking = await Booking.findById(bookingId).populate('event');

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
