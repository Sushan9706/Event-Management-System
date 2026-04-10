const Booking = require('../models/bookingModel');
const Event = require('../models/event');
const User = require('../models/user');
const mongoose = require('mongoose');

exports.createBooking = async (req, res) => {
    try {
        const { eventId, name, firstName, lastName, email, ticketCount: ticketCountRaw } = req.body;
        const userId = req.user.userId;
        const ticketCount = Math.max(1, parseInt(ticketCountRaw, 10) || 1);
        const trimmedFirst = (firstName || '').trim();
        const trimmedLast = (lastName || '').trim();
        const combinedName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ').trim();
        const displayName = combinedName || (name || '').trim();
        const emailValue = (email || '').trim().toLowerCase();
        const namePattern = /^[A-Za-z][A-Za-z' -]{1,39}$/;
        const emailPattern = /^[^\s@]*[A-Za-z][^\s@]*@[^\s@]+\.[^\s@]+$/;
        if (!trimmedFirst || !trimmedLast || !emailValue) {
            return res.status(400).json({ success: false, message: 'Please enter your first name, last name, and email.' });
        }
        if (!namePattern.test(trimmedFirst) || !namePattern.test(trimmedLast)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid first and last name.' });
        }
        if (!emailPattern.test(emailValue)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address with at least one letter before @.' });
        }
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ success: false, message: 'Invalid event. Please reload the page.' });
        }

        // 1. Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
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
                { $match: { eventId: event._id, status: { $ne: 'cancelled' } } },
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
        const createReference = () => `EMS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const buildTicketCodes = (referenceNumber, startIndex, count) => {
            return Array.from({ length: count }, (_, index) => {
                const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
                return `${referenceNumber}-${String(startIndex + index).padStart(2, '0')}-${suffix}`;
            });
        };

        // 4. Merge into existing booking for same event + user (active)
        let booking = await Booking.findOne({
            eventId: event._id,
            userEmail: user.email,
            status: { $ne: 'cancelled' }
        }).sort({ createdAt: -1 });

        if (booking) {
            const existingCodes = Array.isArray(booking.ticketCodes) ? booking.ticketCodes : [];
            const baseCount = Math.max(booking.ticketCount || 0, existingCodes.length);
            const referenceNumber = booking.referenceNumber || createReference();
            const codes = [...existingCodes];

            // backfill any missing codes for existing seats
            if (codes.length < baseCount) {
                const fillCodes = buildTicketCodes(referenceNumber, codes.length + 1, baseCount - codes.length);
                codes.push(...fillCodes);
            }

            const newCodes = buildTicketCodes(referenceNumber, codes.length + 1, ticketCount);
            const newCount = baseCount + ticketCount;

            booking.referenceNumber = referenceNumber;
            booking.bookingRef = booking.bookingRef || referenceNumber;
            booking.userName = (displayName || booking.userName || user.username || '').trim() || user.username;
            booking.ticketCount = newCount;
            booking.unitPrice = unitPrice;
            booking.totalAmount = unitPrice * newCount;
            booking.ticketCodes = [...codes, ...newCodes];
            await booking.save();
        } else {
            const referenceNumber = createReference();
            const ticketCodes = buildTicketCodes(referenceNumber, 1, ticketCount);
            const totalAmount = unitPrice * ticketCount;

            booking = await Booking.create({
                eventId,
                userName: (displayName || user.username || '').trim() || user.username,
                userEmail: user.email,
                ticketCount,
                unitPrice,
                totalAmount,
                ticketCodes,
                referenceNumber,
                bookingRef: referenceNumber
            });
        }

        // 5. Update user's bookedEvents (avoid duplicates) + notifications
        let needsUserSave = false;
        if (!user.bookedEvents.some(id => id.toString() === eventId.toString())) {
            user.bookedEvents.push(eventId);
            needsUserSave = true;
        }
        if (!Array.isArray(user.notifications)) {
            user.notifications = [];
        }
        const eventTitle = event.eventName || event.title || "Event";
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
            ticketCodes: booking.ticketCodes
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
        const requestedStatus = req.query && req.query.status === 'cancelled' ? 'cancelled' : 'confirmed';
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.render("bookings", { user: null, bookings: [], initialStatus: requestedStatus });
        }

        let bookings = await Booking.find({ userEmail: user.email })
            .populate('eventId')
            .sort({ createdAt: -1 });

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

        return res.render("bookings", { user, bookings, initialStatus: requestedStatus });
    } catch (err) {
        console.error("Get Bookings Error:", err);
        const requestedStatus = req.query && req.query.status === 'cancelled' ? 'cancelled' : 'confirmed';
        return res.render("bookings", { user: req.user || null, bookings: [], initialStatus: requestedStatus });
    }
};

exports.getManageBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).populate('eventId');
        if (!booking || !booking.eventId) {
            return res.status(404).render("404", { title: "404 - Page Not Found" });
        }

        const user = await User.findById(req.user.userId);
        if (!user || booking.userEmail !== user.email) {
            return res.redirect('/bookings');
        }

        const ticketCount = booking.ticketCount || 1;
        const existingCodes = Array.isArray(booking.ticketCodes) ? booking.ticketCodes : [];
        if (existingCodes.length < ticketCount) {
            const referenceNumber = booking.referenceNumber || `EMS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const codes = [...existingCodes];
            for (let i = codes.length; i < ticketCount; i += 1) {
                const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
                codes.push(`${referenceNumber}-${String(i + 1).padStart(2, '0')}-${suffix}`);
            }
            booking.referenceNumber = referenceNumber;
            booking.ticketCodes = codes;
            await booking.save();
        }

        return res.render("manageBooking", { booking, user });
    } catch (err) {
        console.error("Get Manage Booking Error:", err);
        return res.redirect('/bookings');
    }
};
