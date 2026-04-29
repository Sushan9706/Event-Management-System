const Event = require('../models/event');
const Booking = require('../models/bookingModel');
const { ACTIVE_BOOKING_STATUSES, hasEventEnded } = require('../utils/bookingStatus');

const getAllEvents = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch events where endDate is today or in the future
        let events = await Event.find({ 
            endDate: { $gte: today },
            status: { $ne: 'cancelled' }
        }).lean();

        // Filter out events that have already ended precisely (date + time)
        events = events.filter(event => !hasEventEnded(event));

        res.render('index', { title: 'Event Master - All Events', events });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).lean();
        if (!event) return res.status(404).render('404', { title: '404 - Not Found' });

        const seatAgg = await Booking.aggregate([
            { $match: { eventId: event._id, status: { $in: ACTIVE_BOOKING_STATUSES } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$ticketCount", 1] } } } }
        ]);

        const currentBookings = seatAgg.length > 0 ? seatAgg[0].total : 0;
        const maxCapacity = Number(event.maxCapacity) || 0;
        const hasCapacityLimit = maxCapacity > 0;
        const hasEnded = hasEventEnded(event);

        event.currentBookings = currentBookings;
        event.availableTickets = hasCapacityLimit ? Math.max(maxCapacity - currentBookings, 0) : null;
        event.isSoldOut = hasCapacityLimit ? event.availableTickets <= 0 : false;
        event.hasEnded = hasEnded;

        res.render('event', { event });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getAllEvents,
    getEventById
};
