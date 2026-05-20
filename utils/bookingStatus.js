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
    let endTimeValue = null;
    if (eventLike && typeof eventLike === 'object') {
        eventDateValue = eventLike.endDate || eventLike.startDate || eventLike.date;
        endTimeValue = eventLike.endTime;
    } else {
        eventDateValue = eventLike;
    }
    
    if (!eventDateValue) {
        return false;
    }

    const eventDate = new Date(eventDateValue);
    if (Number.isNaN(eventDate.getTime())) {
        return false;
    }

    // Combine date with time if endTime exists
    if (endTimeValue && typeof endTimeValue === 'string' && endTimeValue.trim()) {
        const parts = endTimeValue.trim().split(':');
        if (parts.length >= 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            if (!isNaN(hours) && !isNaN(minutes)) {
                eventDate.setHours(hours, minutes, 0, 0);
                return now > eventDate;
            }
        }
    }

    // Default fallback: end of the day
    eventDate.setHours(23, 59, 59, 999);
    return now > eventDate;
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

    const eventDoc = booking.eventId || booking.event || null;
    if (!eventDoc) return false;
    return isEventDatePassed(eventDoc, now);
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

        // 1. Sync Event Statuses dynamically using exact date/time
        const activeEvents = await Event.find({ status: { $ne: 'cancelled' } });
        for (const event of activeEvents) {
            if (hasEventEnded(event, now)) {
                if (event.status !== 'completed') {
                    event.status = 'completed';
                    await event.save();
                }
            } else {
                let startDateTime = new Date(event.startDate);
                if (event.startTime && typeof event.startTime === 'string' && event.startTime.trim()) {
                    const parts = event.startTime.trim().split(':');
                    if (parts.length >= 2) {
                        const hours = parseInt(parts[0], 10);
                        const minutes = parseInt(parts[1], 10);
                        if (!isNaN(hours) && !isNaN(minutes)) {
                            startDateTime.setHours(hours, minutes, 0, 0);
                        }
                    }
                } else {
                    startDateTime.setHours(0, 0, 0, 0);
                }

                if (now >= startDateTime) {
                    if (event.status !== 'ongoing') {
                        event.status = 'ongoing';
                        await event.save();
                    }
                } else {
                    if (event.status !== 'upcoming') {
                        event.status = 'upcoming';
                        await event.save();
                    }
                }
            }
        }

        // 2. Sync Event Bookings Expiry
        const activeBookings = await Booking.find({ status: { $in: ['confirmed', 'pending'] } }).populate('eventId');
        const saves = [];
        for (const booking of activeBookings) {
            if (booking.eventId && hasEventEnded(booking.eventId, now)) {
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
