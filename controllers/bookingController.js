const Booking = require('../models/bookingModel');
const Event = require('../models/event');
const User = require('../models/user');
const mongoose = require('mongoose');
const os = require('os');
const { isEventDatePassed, syncBookingExpiry, syncBookingsExpiry } = require('../utils/bookingStatus');

const MAX_TICKETS_PER_BOOKING = 5;

const pickEventName = (event, fallback = 'Event') => {
    if (!event) return fallback;
    return event.eventName || event.title || event.name || event.eventTitle || fallback;
};

const isLocalHost = (host = '') => {
    const hostname = host.replace(/^https?:\/\//, '').split(':')[0].toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const getLanAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const addresses of Object.values(interfaces)) {
        for (const address of addresses || []) {
            if (address.family === 'IPv4' && !address.internal) {
                return address.address;
            }
        }
    }
    return '';
};

const getPublicBaseUrl = (req) => {
    const configured = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    if (configured && !isLocalHost(configured)) return configured;

    const requestHost = req.get('host') || '';
    if (isLocalHost(requestHost)) {
        const lanAddress = getLanAddress();
        const port = requestHost.includes(':') ? `:${requestHost.split(':').pop()}` : '';
        if (lanAddress) return `${req.protocol}://${lanAddress}${port}`;
    }

    return configured || `${req.protocol}://${requestHost}`;
};

const createRef = () => `EMS-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const buildTicketCodes = (refNum, startIndex, count) => (
    Array.from({ length: count }, (_, index) => {
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `${refNum}-${String(startIndex + index).padStart(2, '0')}-${suffix}`;
    })
);

const normalizeAttendeeName = (value = '') => value.trim().replace(/\s+/g, ' ');
const attendeeNamePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const normalizeAttendeeNames = (value) => (
    Array.isArray(value)
        ? value.map(name => normalizeAttendeeName(String(name || '')))
        : []
);

exports.createBooking = async (req, res) => {
    try {
        const { eventId, email, ticketCount: ticketCountRaw, attendeeNames: attendeeNamesRaw } = req.body;
        const userId = req.user.userId;
        const ticketCountValue = typeof ticketCountRaw === 'string' ? ticketCountRaw.trim() : String(ticketCountRaw || '').trim();
        const ticketCount = Number(ticketCountValue);
        const emailValue = (email || '').trim().toLowerCase();
        const attendeeNames = normalizeAttendeeNames(attendeeNamesRaw);
        const emailPattern = /^[^\s@]*[A-Za-z][^\s@]*@[^\s@]+\.[^\s@]+$/;
        if (!emailValue) {
            return res.status(400).json({ success: false, message: 'Please enter your email address.' });
        }
        if (!emailPattern.test(emailValue)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address with at least one letter before @.' });
        }
        if (!/^[1-9]\d*$/.test(ticketCountValue) || !Number.isInteger(ticketCount)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid number of tickets.' });
        }
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ success: false, message: 'Invalid event. Please reload the page.' });
        }
        if (ticketCount > MAX_TICKETS_PER_BOOKING) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${MAX_TICKETS_PER_BOOKING} tickets per booking. If you want more, buy again.`
            });
        }
        if (attendeeNames.length !== ticketCount || attendeeNames.some(name => !name)) {
            return res.status(400).json({ success: false, message: `Please enter attendee full name for all ${ticketCount} ticket${ticketCount === 1 ? '' : 's'}.` });
        }
        if (attendeeNames.some(name => !attendeeNamePattern.test(name))) {
            return res.status(400).json({ success: false, message: 'Attendee names can contain letters and single spaces only.' });
        }
        const uniqueNames = new Set(attendeeNames.map(name => name.toLowerCase()));
        if (uniqueNames.size !== attendeeNames.length) {
            return res.status(400).json({ success: false, message: 'Please enter a different attendee name for each ticket.' });
        }

        // 1. Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        if (isEventDatePassed(event)) {
            return res.status(400).json({ success: false, message: 'Booking closed. This event date has passed.' });
        }

        // 2. Load user (each purchase becomes its own booking/order)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (!Array.isArray(user.bookedEvents)) {
            user.bookedEvents = [];
        }

        // 3. Capacity check (by seats)
        if (event.maxCapacity && event.maxCapacity > 0) {
            const seatAgg = await Booking.aggregate([
                { $match: { eventId: event._id, status: { $nin: ['cancelled', 'expired'] } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$ticketCount", 1] } } } }
            ]);
            const bookedSeats = seatAgg.length > 0 ? seatAgg[0].total : 0;
            if (bookedSeats + ticketCount > event.maxCapacity) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${Math.max(event.maxCapacity - bookedSeats, 0)} seats left for this event`
                });
            }
        }

        const unitPrice = typeof event.ticketPrice === 'number' ? event.ticketPrice : 0;

        const alreadyAgg = await Booking.aggregate([
            {
                $match: {
                    eventId: event._id,
                    userEmail: user.email,
                    status: { $nin: ['cancelled', 'expired'] }
                }
            },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$ticketCount', 1] } } } }
        ]);
        const alreadyBooked = alreadyAgg.length > 0 ? alreadyAgg[0].total : 0;

        // 4. Each checkout is its own booking, while My Bookings groups same-event rows.
        const ref_num = createRef();
        const ticketCodes = buildTicketCodes(ref_num, 1, ticketCount);
        const totalAmount = unitPrice * ticketCount;
        const booking = await Booking.create({
            eventId: event._id,
            userName: attendeeNames[0],
            userEmail: user.email,
            attendeeEmail: emailValue,
            attendeeNames,
            ticketCount,
            unitPrice,
            totalAmount,
            ticketCodes,
            referenceNumber: ref_num,
            bookingRef: ref_num
        });

        // 5. Update user's bookedEvents + notifications
        let needsUserSave = false;
        if (!user.bookedEvents.some(id => id.toString() === eventId.toString())) {
            user.bookedEvents.push(eventId);
            needsUserSave = true;
        }
        if (!Array.isArray(user.notifications)) {
            user.notifications = [];
        }
        const eventTitle = pickEventName(event);
        user.notifications.unshift({
            type: "booking_confirmed",
            eventId: event._id,
            eventName: eventTitle,
            ticketCount,
            createdAt: new Date()
        });
        if (user.notifications.length > 20) {
            user.notifications = user.notifications.slice(0, 20);
        }
        needsUserSave = true;
        if (needsUserSave) {
            await user.save();
        }

        res.json({
            success: true,
            message: 'Booking confirmed!',
            referenceNumber: booking.referenceNumber,
            ticketCount: booking.ticketCount,
            totalAmount: booking.totalAmount,
            bookingId: booking._id,
            ticketCodes: booking.ticketCodes,
            attendeeNames: booking.attendeeNames,
            alreadyBooked: alreadyBooked + ticketCount
        });

    } catch (err) {
        console.error('Booking Error:', err);
        if (err && err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Booking reference conflict. Please try again.'
            });
        }
        return res.status(500).json({
            success: false,
            message: err && err.message ? err.message : 'Failed to process booking'
        });
    }
};

exports.getBookingsPage = async (req, res) => {
    try {
        const requestedStatus = req.query && ['cancelled', 'expired'].includes(req.query.status) ? req.query.status : 'confirmed';
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.render("bookings", { user: null, bookings: [], initialStatus: requestedStatus });
        }

        let bookings = await Booking.find({ userEmail: user.email })
            .populate('eventId')
            .sort({ createdAt: -1 });

        await syncBookingsExpiry(bookings);

        bookings = bookings
            .filter(booking => booking.eventId)
            .map(booking => {
                const ticketCount = booking.ticketCount || 1;
                const unitPrice = typeof booking.unitPrice === 'number'
                    ? booking.unitPrice
                    : (booking.eventId && typeof booking.eventId.ticketPrice === 'number' ? booking.eventId.ticketPrice : 0);
                booking.ticketCount = ticketCount;
                booking.unitPrice = unitPrice;
                booking.totalAmount = typeof booking.totalAmount === 'number'
                    ? booking.totalAmount
                    : unitPrice * ticketCount;
                return booking;
            });

        const groupedBookings = [];
        const groupedByEventAndStatus = new Map();
        for (const booking of bookings) {
            const status = (booking.status || 'confirmed').toLowerCase();
            const safeStatus = ['cancelled', 'expired'].includes(status) ? status : 'confirmed';
            const eventId = booking.eventId && booking.eventId._id ? booking.eventId._id.toString() : String(booking.eventId);
            const key = `${safeStatus}:${eventId}`;
            const ticketCount = booking.ticketCount || 1;
            const totalAmount = typeof booking.totalAmount === 'number'
                ? booking.totalAmount
                : (booking.unitPrice || 0) * ticketCount;

            if (!groupedByEventAndStatus.has(key)) {
                const plain = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
                plain.ticketCount = ticketCount;
                plain.totalAmount = totalAmount;
                plain.status = safeStatus;
                plain.references = [booking.referenceNumber].filter(Boolean);
                plain.ticketCodes = Array.isArray(booking.ticketCodes) ? [...booking.ticketCodes] : [];
                groupedByEventAndStatus.set(key, plain);
                groupedBookings.push(plain);
            } else {
                const group = groupedByEventAndStatus.get(key);
                group.ticketCount += ticketCount;
                group.totalAmount += totalAmount;
                if (booking.referenceNumber && !group.references.includes(booking.referenceNumber)) {
                    group.references.push(booking.referenceNumber);
                }
                if (Array.isArray(booking.ticketCodes)) {
                    group.ticketCodes.push(...booking.ticketCodes);
                }
                group.referenceNumber = group.references.length > 1
                    ? `${group.references[0]} + ${group.references.length - 1} more`
                    : group.references[0];
            }
        }

        return res.render("bookings", { user, bookings: groupedBookings, initialStatus: requestedStatus });
    } catch (err) {
        console.error("Get Bookings Error:", err);
        const requestedStatus = req.query && ['cancelled', 'expired'].includes(req.query.status) ? req.query.status : 'confirmed';
        return res.render("bookings", { user: req.user || null, bookings: [], initialStatus: requestedStatus });
    }
};

exports.getManageBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('eventId');
        if (!booking || !booking.eventId) {
            return res.status(404).render("404", { title: "404 - Page Not Found" });
        }

        await syncBookingExpiry(booking);

        const user = await User.findById(req.user.userId);
        if (!user || booking.userEmail !== user.email) {
            return res.redirect('/bookings');
        }

        const ticketCount = booking.ticketCount || 1;
        const existingCodes = Array.isArray(booking.ticketCodes) ? booking.ticketCodes : [];
        if (existingCodes.length < ticketCount) {
            const ref_num = booking.referenceNumber || `EMS-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            const codes = [...existingCodes];
            for (let i = codes.length; i < ticketCount; i += 1) {
                const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
                codes.push(`${ref_num}-${String(i + 1).padStart(2, '0')}-${suffix}`);
            }
            booking.referenceNumber = ref_num;
            booking.ticketCodes = codes;
            await booking.save();
        }

        return res.render("manageBooking", { booking, user, publicBaseUrl: getPublicBaseUrl(req) });
    } catch (err) {
        console.error("Get Manage Booking Error:", err);
        return res.redirect('/bookings');
    }
};

exports.getTicketDetails = async (req, res) => {
    try {
        const ticketCode = decodeURIComponent(req.params.ticketCode || '').trim();
        if (!ticketCode) {
            return res.status(404).render("404", { title: "Ticket Not Found" });
        }

        const booking = await Booking.findOne({ ticketCodes: ticketCode }).populate('eventId').lean();
        if (!booking || !booking.eventId) {
            return res.status(404).render("404", { title: "Ticket Not Found" });
        }

        const event = booking.eventId;
        const ticketCodes = Array.isArray(booking.ticketCodes) ? booking.ticketCodes : [];
        const ticketIndex = Math.max(ticketCodes.findIndex(code => code === ticketCode), 0);
        const ticketCount = Math.max(booking.ticketCount || ticketCodes.length || 1, 1);
        const attendeeNames = Array.isArray(booking.attendeeNames) ? booking.attendeeNames : [];
        const unitPrice = typeof booking.unitPrice === 'number'
            ? booking.unitPrice
            : (typeof event.ticketPrice === 'number' ? event.ticketPrice : 0);
        const formatDateLabel = (value) => {
            if (!value) return "TBA";
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return "TBA";
            return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        };
        const startDate = formatDateLabel(event.startDate || event.date);
        const endDate = formatDateLabel(event.endDate || event.startDate || event.date);
        const eventDate = startDate === endDate || endDate === "TBA" ? startDate : `${startDate} - ${endDate}`;
        const eventTime = event.startTime || event.endTime
            ? `${event.startTime || "TBA"}${event.endTime ? " - " + event.endTime : ""}`
            : (event.time || "TBA");

        const ticket = {
            code: ticketCode,
            eventName: pickEventName(event, booking.eventName),
            status: (booking.status || "confirmed").toUpperCase(),
            ticketPosition: `${ticketIndex + 1} of ${ticketCount}`,
            attendeeName: attendeeNames[ticketIndex] || "-",
            attendeeEmail: booking.attendeeEmail || booking.userEmail || "-",
            date: eventDate,
            time: eventTime,
            location: event.location || booking.eventLocation || "TBA",
            price: unitPrice === 0 ? "Free" : `$${unitPrice % 1 === 0 ? unitPrice.toFixed(0) : unitPrice.toFixed(2)}`,
            reference: booking.referenceNumber || "-",
            bookedOn: booking.createdAt
                ? new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                : "TBA"
        };

        return res.render("ticketDetails", { ticket });
    } catch (err) {
        console.error("Get Ticket Details Error:", err);
        return res.status(500).render("404", { title: "Ticket Not Found" });
    }
};
