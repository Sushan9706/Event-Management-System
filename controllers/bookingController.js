const Booking = require('../models/bookingModel');
const Event = require('../models/event');
const User = require('../models/user');

exports.createBooking = async (req, res) => {
    try {
        const { eventId } = req.body;
        const userId = req.user.userId;

        // 1. Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // 2. Check if user already booked this event
        const user = await User.findById(userId);
        if (user.bookedEvents.includes(eventId)) {
            return res.status(400).json({ success: false, message: 'You have already booked this event' });
        }

        // 3. Create booking record
        const referenceNumber = 'EMS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        const booking = await Booking.create({
            eventId,
            userName: user.username,
            userEmail: user.email,
            referenceNumber
        });

        // 4. Update user's bookedEvents
        user.bookedEvents.push(eventId);
        await user.save();

        res.json({ 
            success: true, 
            message: 'Booking confirmed!', 
            referenceNumber: referenceNumber 
        });

    } catch (err) {
        console.error('Booking Error:', err);
        res.status(500).json({ success: false, message: 'Failed to process booking' });
    }
};
