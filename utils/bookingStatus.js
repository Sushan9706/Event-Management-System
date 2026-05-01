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

module.exports = {
    ACTIVE_BOOKING_STATUSES,
    getEventExpiryCutoff,
    isEventDatePassed,
    hasEventEnded,
    shouldExpireBooking,
    syncBookingExpiry,
    syncBookingsExpiry
};
