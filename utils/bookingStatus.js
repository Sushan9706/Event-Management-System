const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending'];

const getEventExpiryCutoff = (eventDateValue) => {
    if (eventDateValue === null || eventDateValue === undefined || eventDateValue === '') {
        return null;
    }

    const eventDate = new Date(eventDateValue);
    if (Number.isNaN(eventDate.getTime())) {
        return null;
    }

    eventDate.setHours(23, 59, 59, 999);
    return eventDate;
};

const isEventDatePassed = (eventLike, now = new Date()) => {
    let eventDateValue = null;
    if (eventLike && typeof eventLike === 'object') {
        eventDateValue = eventLike.endDate || eventLike.startDate || eventLike.date;
    } else {
        eventDateValue = eventLike;
    }
    const cutoff = getEventExpiryCutoff(eventDateValue);
    if (!cutoff) {
        return false;
    }

    return now > cutoff;
};

const hasEventEnded = (eventLike, now = new Date()) => isEventDatePassed(eventLike, now);

const shouldExpireBooking = (booking, now = new Date()) => {
    if (!booking) {
        return false;
    }

    const status = (booking.status || 'confirmed').toLowerCase();
    if (status === 'cancelled' || status === 'expired') {
        return false;
    }

    // booking.eventId may be an ObjectId if not populated; only expire when a real date is available.
    const eventDoc = booking.eventId || booking.event || null;
    if (!eventDoc) return false;
    const dateValue = (typeof eventDoc === 'object' && eventDoc !== null && 'date' in eventDoc)
        ? eventDoc.date
        : null;
    if (!dateValue) return false;
    return isEventDatePassed({ date: dateValue }, now);
};

const syncBookingExpiry = async (booking, now = new Date()) => {
    if (!shouldExpireBooking(booking, now)) {
        return booking;
    }

    booking.status = 'expired';
    if (booking && booking._id && booking.constructor && typeof booking.constructor.updateOne === 'function') {
        await booking.constructor.updateOne({ _id: booking._id }, { $set: { status: 'expired' } });
    }
    return booking;
};

const syncBookingsExpiry = async (bookings, now = new Date()) => {
    if (!Array.isArray(bookings) || bookings.length === 0) {
        return bookings || [];
    }

    const saves = [];
    for (const booking of bookings) {
        if (!shouldExpireBooking(booking, now)) {
            continue;
        }

        booking.status = 'expired';
        if (booking && booking._id && booking.constructor && typeof booking.constructor.updateOne === 'function') {
            saves.push(booking.constructor.updateOne({ _id: booking._id }, { $set: { status: 'expired' } }));
        }
    }

    if (saves.length > 0) {
        await Promise.all(saves);
    }

    return bookings;
};

const syncDatabase = async () => {
    try {
        const Event = require('../models/event');
        const Booking = require('../models/bookingModel');
        const VenueBooking = require('../models/venueBookingModel');
        const now = new Date();

        // 1. Sync Event Statuses
        await Event.updateMany(
            { endDate: { $lt: now }, status: { $in: ['upcoming', 'ongoing'] } },
            { $set: { status: 'completed' } }
        );
        await Event.updateMany(
            { startDate: { $lte: now }, endDate: { $gte: now }, status: 'upcoming' },
            { $set: { status: 'ongoing' } }
        );

        // 2. Sync Event Bookings Expiry
        const activeBookings = await Booking.find({ status: { $in: ['confirmed', 'pending'] } }).populate('eventId');
        const saves = [];
        for (const booking of activeBookings) {
            if (booking.eventId && now > new Date(booking.eventId.endDate)) {
                booking.status = 'expired';
                saves.push(booking.save());
            }
        }
        if (saves.length > 0) {
            await Promise.all(saves);
        }

        // 3. Sync Venue Bookings Expiry
        const activeVenueBookings = await VenueBooking.find({ status: { $in: ['confirmed', 'pending'] } });
        const venueSaves = [];
        for (const booking of activeVenueBookings) {
            const bookingEnd = new Date(booking.endDate);
            bookingEnd.setHours(23, 59, 59, 999);
            if (now > bookingEnd) {
                booking.status = 'expired';
                venueSaves.push(booking.save());
            }
        }
        if (venueSaves.length > 0) {
            await Promise.all(venueSaves);
        }
    } catch (err) {
        console.error("Error in syncDatabase:", err);
    }
};

module.exports = {
    ACTIVE_BOOKING_STATUSES,
    getEventExpiryCutoff,
    isEventDatePassed,
    hasEventEnded,
    shouldExpireBooking,
    syncBookingExpiry,
    syncBookingsExpiry,
    syncDatabase
};
