const Venue = require('../models/venueModel');
const userModel = require('../models/user');
const VenueBooking = require('../models/venueBookingModel');
const {
    ESEWA_PRODUCT_CODE,
    ESEWA_FORM_URL,
    buildEsewaPaymentPayload,
    lookupEsewaPayment,
    toEsewaAmount
} = require('../config/esewa');

const VENUE_CHECKOUT_TTL_MS = 30 * 60 * 1000;
const VENUE_PHONE_REGEX = /^(?:\+?977[-\s]?)?(98\d{8})$/;
const getVenuePendingCutoff = () => new Date(Date.now() - VENUE_CHECKOUT_TTL_MS);

const clearExpiredPendingVenueBookings = async (venueId = null) => {
    const query = {
        status: 'pending',
        paymentStatus: { $ne: 'paid' },
        createdAt: { $lt: getVenuePendingCutoff() }
    };
    if (venueId) {
        query.venueId = venueId;
    }
    await VenueBooking.updateMany(query, {
        $set: {
            status: 'cancelled',
            paymentStatus: 'unpaid'
        }
    });
};

const getVenuePaymentCheckouts = (req) => {
    if (!req.session.venuePaymentCheckouts) {
        req.session.venuePaymentCheckouts = {};
    }
    return req.session.venuePaymentCheckouts;
};

const decodeEsewaDataPayload = (encoded) => {
    const raw = String(encoded || '').trim();
    if (!raw) return null;
    try {
        const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
        return null;
    }
};

const normalizePhoneNumber = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.startsWith('977') && digits.length === 12) {
        return digits.slice(3);
    }
    return digits;
};

const validateVenueDatesAndTimes = ({ startDate, endDate, startTime, endTime }) => {
    if (!startDate || !endDate || !startTime || !endTime) {
        return 'Please select both start and end dates and times.';
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 'Please select valid start and end dates.';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
        return 'Cannot book a date in the past.';
    }
    const now = new Date();
    now.setSeconds(0, 0);
    if (start < now) {
        return 'Venue booking start time cannot be in the past.';
    }
    if (start > end) {
        return 'Start date cannot be after end date.';
    }
    
    const timeDiffMs = end.getTime() - start.getTime();
    const hoursDiff = timeDiffMs / (1000 * 60 * 60);
    if (hoursDiff < 1) {
        return 'Minimum booking duration is 1 hour.';
    }
    const maxDurationMs = 30 * 24 * 60 * 60 * 1000;
    if (timeDiffMs > maxDurationMs) {
        return 'Maximum booking duration is 30 days.';
    }

    return null;
};

const calculateVenueAmount = ({ venue, startDate, endDate, startTime, endTime }) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let totalAmount = 0;
    if (venue.dailyRate) {
        totalAmount = venue.dailyRate * diffDays;
    } else if (venue.hourlyRate) {
        const startT = String(startTime).split(':');
        const endT = String(endTime).split(':');
        const startHour = (parseInt(startT[0], 10) || 0) + ((parseInt(startT[1], 10) || 0) / 60);
        const endHour = (parseInt(endT[0], 10) || 0) + ((parseInt(endT[1], 10) || 0) / 60);
        const dailyHours = Math.max(endHour - startHour, 0);
        totalAmount = venue.hourlyRate * dailyHours * diffDays;
    }
    return Number(totalAmount.toFixed(2));
};

exports.getVenues = async (req, res) => {
    try {
        const venues = await Venue.find({ status: { $in: ['available', 'maintenance'] } }).lean();
        
        let fullUser = null;
        if (req.user && req.user.userId) {
            fullUser = await userModel.findById(req.user.userId);
        }

        res.render('venues', {
            venues: venues,
            user: fullUser,
            title: 'EMS - Discover Venues'
        });
    } catch (err) {
        console.error("Error loading venues:", err);
        res.status(500).send("Error loading venues");
    }
};

exports.getVenueById = async (req, res) => {
    try {
        await clearExpiredPendingVenueBookings(req.params.id);
        const venue = await Venue.findById(req.params.id).lean();
        if (!venue) return res.status(404).render('404', { title: '404 - Not Found' });

        // Fetch existing bookings to show availability
        const bookings = await VenueBooking.find({ 
            venueId: req.params.id,
            $or: [
                { status: 'confirmed' },
                { status: 'pending', createdAt: { $gte: getVenuePendingCutoff() } }
            ]
        }).select('startDate endDate').lean();

        // Expand ranges into individual days for the calendar
        const bookedDateSet = new Set();
        const toLocalDateKey = (date) => {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        bookings.forEach(b => {
            let curr = new Date(b.startDate);
            const end = new Date(b.endDate);
            while (curr <= end) {
                bookedDateSet.add(toLocalDateKey(curr));
                curr.setDate(curr.getDate() + 1);
            }
        });
        const bookedDates = Array.from(bookedDateSet);

        res.render('venueDetail', { 
            venue, 
            user: req.user || null,
            bookedDates: JSON.stringify(bookedDates)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.searchVenues = async (req, res) => {
    try {
        let { q, location, capacity } = req.query;
        let queryObj = { status: { $in: ['available', 'maintenance'] } };

        if (q) {
            queryObj.name = { $regex: q, $options: "i" };
        }

        if (location) {
            queryObj.location = { $regex: location, $options: "i" };
        }

        if (capacity) {
            queryObj.capacity = { $gte: parseInt(capacity) };
        }

        const venues = await Venue.find(queryObj).lean();
        res.render("venues", { venues: venues, user: req.user || null });
    } catch (err) {
        console.error("Search failed:", err);
        res.status(500).send("Search failed");
    }
};

exports.bookVenue = async (req, res) => {
    try {
        const { venueId, startDate, endDate, startTime, endTime, phoneNumber, paymentMethod } = req.body;
        const userId = req.user.userId;
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        const method = String(paymentMethod || 'esewa').trim().toLowerCase() === 'wallet' ? 'wallet' : 'esewa';

        const venue = await Venue.findById(venueId);
        if (!venue) return res.status(404).json({ success: false, message: "Venue not found" });

        if (venue.status === 'maintenance') {
            return res.status(400).json({ success: false, message: "This venue is currently under maintenance and cannot be booked." });
        }

        const dateValidationError = validateVenueDatesAndTimes({ startDate, endDate, startTime, endTime });
        if (dateValidationError) {
            return res.status(400).json({ success: false, message: dateValidationError });
        }
        if (!normalizedPhone || !VENUE_PHONE_REGEX.test(normalizedPhone)) {
            return res.status(400).json({ success: false, message: "Please enter a valid mobile number." });
        }

        await clearExpiredPendingVenueBookings(venueId);
        const existingBookings = await VenueBooking.find({
            venueId,
            $and: [
                {
                    $or: [
                        { status: 'confirmed' },
                        { status: 'pending', createdAt: { $gte: getVenuePendingCutoff() } }
                    ]
                },
                {
                    $or: [
                        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
                    ]
                }
            ]
        });

        if (existingBookings.length > 0) {
            return res.status(400).json({ success: false, message: "Venue is already booked for some dates in this range." });
        }

        const totalAmount = calculateVenueAmount({ venue, startDate, endDate, startTime, endTime });
        if (totalAmount <= 0) {
            return res.status(400).json({ success: false, message: "Venue amount must be greater than zero." });
        }

        const referenceNumber = 'V-EMS-' + Math.random().toString(36).slice(2, 11).toUpperCase();
        const transactionUuid = `VESW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const successUrl = `${req.protocol}://${req.get('host')}/venue/payments/esewa/success/${encodeURIComponent(transactionUuid)}`;
        const failureUrl = `${req.protocol}://${req.get('host')}/venue/payments/esewa/success/${encodeURIComponent(transactionUuid)}`;
        const totalEsewaAmount = toEsewaAmount(totalAmount);

        const newBooking = await VenueBooking.create({
            venueId,
            userId,
            startDate,
            endDate,
            startTime,
            endTime,
            phoneNumber: normalizedPhone,
            totalAmount,
            status: 'pending',
            paymentStatus: 'unpaid',
            referenceNumber
        });

        const checkouts = getVenuePaymentCheckouts(req);
        const expiresAt = Date.now() + VENUE_CHECKOUT_TTL_MS;
        checkouts[transactionUuid] = {
            transactionUuid,
            venueBookingId: newBooking._id.toString(),
            venueId: venue._id.toString(),
            userId: userId.toString(),
            totalAmount,
            paymentProvider: method,
            productCode: ESEWA_PRODUCT_CODE,
            createdAt: Date.now(),
            expiresAt
        };
        req.session.venuePaymentCheckouts = checkouts;

        if (method === 'wallet') {
            return req.session.save(() => res.json({
                success: true,
                paymentProvider: 'wallet',
                transaction_uuid: transactionUuid,
                redirect_url: `/payments/wallet/${encodeURIComponent(transactionUuid)}?bookingType=venue`,
                expires_at: new Date(expiresAt).toISOString(),
                expires_in: Math.max(Math.ceil((expiresAt - Date.now()) / 1000), 1)
            }));
        }

        const esewaPayload = buildEsewaPaymentPayload({
            amount: totalEsewaAmount,
            transactionUuid,
            successUrl,
            failureUrl
        });

        return req.session.save(() => res.json({
            success: true,
            paymentProvider: 'esewa',
            payment_url: ESEWA_FORM_URL,
            form_fields: esewaPayload,
            transaction_uuid: transactionUuid,
            expires_at: new Date(expiresAt).toISOString(),
            expires_in: Math.max(Math.ceil((expiresAt - Date.now()) / 1000), 1)
        }));
    } catch (err) {
        console.error("Booking error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.handleVenueEsewaSuccess = async (req, res) => {
    try {
        const queryStatus = String(req.query.status || '').trim().toUpperCase();
        const esewaData = decodeEsewaDataPayload(req.query.data);
        const transactionUuid = String(
            req.params.transactionUuid
            || req.query.transaction_uuid
            || (esewaData && (esewaData.transaction_uuid || esewaData.transaction_code))
            || ''
        ).trim();

        if (!transactionUuid) {
            return res.redirect('/payments/success?provider=esewa&status=failed&eventName=Venue%20Booking');
        }

        const checkouts = req.session.venuePaymentCheckouts || {};
        const checkout = checkouts[transactionUuid];
        if (!checkout) {
            return res.redirect('/payments/success?provider=esewa&status=expired&eventName=Venue%20Booking');
        }

        const venueBooking = await VenueBooking.findById(checkout.venueBookingId);
        if (!venueBooking) {
            delete checkouts[transactionUuid];
            req.session.venuePaymentCheckouts = checkouts;
            return req.session.save(() => res.redirect('/payments/success?provider=esewa&status=failed&eventName=Venue%20Booking'));
        }

        let finalStatus = 'FAILED';
        if (queryStatus !== 'CANCELLED' && queryStatus !== 'FAILED') {
            try {
                const lookupResponse = await lookupEsewaPayment({
                    transactionUuid,
                    totalAmount: checkout.totalAmount,
                    productCode: checkout.productCode || ESEWA_PRODUCT_CODE
                });
                finalStatus = String(lookupResponse.status || 'FAILED').trim().toUpperCase();
            } catch (err) {
                finalStatus = 'FAILED';
            }
        }

        if (finalStatus === 'COMPLETE' || finalStatus === 'COMPLETED') {
            venueBooking.status = 'confirmed';
            venueBooking.paymentStatus = 'paid';
            await venueBooking.save();
            const venue = await Venue.findById(venueBooking.venueId).select('name').lean();

            const user = await userModel.findById(venueBooking.userId);
            if (user) {
                if (!Array.isArray(user.notifications)) {
                    user.notifications = [];
                }
                user.notifications.unshift({
                    type: 'booking_confirmed',
                    eventId: venueBooking.venueId,
                    eventName: (venue && venue.name) ? venue.name : 'Venue Booking',
                    ticketCount: 1,
                    createdAt: new Date()
                });
                if (user.notifications.length > 20) {
                    user.notifications = user.notifications.slice(0, 20);
                }
                await user.save();
            }

            delete checkouts[transactionUuid];
            req.session.venuePaymentCheckouts = checkouts;
            const venueName = encodeURIComponent((venue && venue.name) ? venue.name : 'Venue Booking');
            return req.session.save(() => res.redirect(`/payments/success?provider=free&bookingType=venue&bookingId=${venueBooking._id}&eventName=${venueName}`));
        }

        venueBooking.status = 'cancelled';
        venueBooking.paymentStatus = 'unpaid';
        await venueBooking.save();
        const venue = await Venue.findById(venueBooking.venueId).select('name').lean();
        delete checkouts[transactionUuid];
        req.session.venuePaymentCheckouts = checkouts;
        const venueName = encodeURIComponent((venue && venue.name) ? venue.name : 'Venue Booking');
        return req.session.save(() => res.redirect(`/payments/success?provider=esewa&status=cancelled&eventName=${venueName}`));
    } catch (err) {
        console.error('Venue eSewa callback error:', err);
        return res.redirect('/payments/success?provider=esewa&status=failed&eventName=Venue%20Booking');
    }
};
