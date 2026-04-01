const Booking = require('../models/bookingModel');
const Event = require('../models/eventModel');

// Required for Manage Booking page (attendee name + email display)
const userModel = require('../models/user');

// ================================================================
// PRE-EXISTING FUNCTIONS (other team members' tasks — do not edit)
// ================================================================

// POST /bookings/book/:eventId - Book an event
exports.bookEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).render('404', { title: '404 - Not Found' });

        // Check if already booked
        const existing = await Booking.findOne({ user: req.user.userId, event: event._id });
        if (existing) {
            req.flash('error', 'You have already booked this event.');
            return res.redirect(`/events/${event._id}`);
        }

        // Check capacity
        if (event.currentBookings >= event.maxCapacity) {
            req.flash('error', 'This event is fully booked.');
            return res.redirect(`/events/${event._id}`);
        }

        // Create booking
        const booking = await Booking.create({
            user: req.user.userId,
            event: event._id,
            amount: event.ticketPrice,
            status: 'confirmed'
        });

        // Update event booking count
        event.currentBookings += 1;
        await event.save();

        res.redirect(`/bookings/confirmation/${booking._id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Booking failed');
    }
};

// GET /bookings/confirmation/:bookingId - Show booking confirmation
exports.getConfirmation = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('event');
        if (!booking) return res.status(404).render('404', { title: '404 - Not Found' });

        // Only the booking owner can view it
        if (booking.user.toString() !== req.user.userId.toString()) {
            return res.redirect('/');
        }

        res.render('bookingConfirmation', { booking, user: req.user });
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// ================================================================
// MY TASK — Manage Booking page, My Bookings list, Cancel Booking
// ================================================================

// GET /bookings/manage/:bookingId  —  Manage Booking detail page
exports.getManageBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('event');

        if (!booking) {
            return res.status(404).render('404', { title: '404 - Not Found' });
        }

        // Only the booking owner can view this page
        if (booking.user.toString() !== req.user.userId.toString()) {
            req.flash('error', 'You are not authorised to view this booking.');
            return res.redirect('/bookings/my-bookings');
        }

        // Fetch the full user document so we have username + email for attendee section
        const user = await userModel.findById(req.user.userId);

        res.render('manageBooking', { booking, user });
    } catch (err) {
        console.error('getManageBooking error:', err);
        res.status(500).send('Server Error');
    }
};

// GET /bookings/my-bookings  —  List all bookings for logged-in user
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user.userId })
            .populate('event')
            .sort({ createdAt: -1 });

        const user = await userModel.findById(req.user.userId);

        res.render('myBookings', { bookings, user });
    } catch (err) {
        console.error('getMyBookings error:', err);
        res.status(500).send('Server Error');
    }
};

// POST /bookings/cancel/:bookingId  —  Cancel a booking (AJAX)
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('event');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        // Security: only the owner can cancel
        if (booking.user.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorised.' });
        }

        // Prevent double-cancellation
        if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'This booking is already cancelled.' });
        }

        // Update booking status
        booking.status = 'cancelled';
        await booking.save();

        // Decrement the event's currentBookings count (never go below 0)
        if (booking.event && booking.event.currentBookings > 0) {
            await Event.findByIdAndUpdate(booking.event._id, {
                $inc: { currentBookings: -1 }
            });
        }

        return res.status(200).json({ success: true, message: 'Booking cancelled successfully.' });
    } catch (err) {
        console.error('cancelBooking error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};
