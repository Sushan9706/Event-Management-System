const Booking = require('../models/bookingModel');
const VenueBooking = require('../models/venueBookingModel');
const Event = require('../models/event');
const User = require('../models/user');
const mongoose = require('mongoose');
const os = require('os');
const { isEventDatePassed, syncBookingExpiry, syncBookingsExpiry } = require('../utils/bookingStatus');
const {
    ESEWA_PRODUCT_CODE,
    ESEWA_FORM_URL,
    buildEsewaPaymentPayload,
    lookupEsewaPayment,
    toEsewaAmount
} = require('../config/esewa');

const MAX_TICKETS_PER_BOOKING = 5;
const PAYMENT_CHECKOUT_TTL_MS = 30 * 60 * 1000;
const EMS_WALLET_TEST_PHONE = '9876543210';
const EMS_WALLET_TEST_PIN = '2324';
const EMS_WALLET_TEST_OTP = '121314';
const createHttpError = (status, message, payload) => {
    const error = new Error(message);
    error.status = status;
    if (payload) {
        error.payload = payload;
    }
    return error;
};

const pickEventName = (event, fallback = 'Event') => {
    if (!event) return fallback;
    return event.eventName || event.title || event.name || event.eventTitle || fallback;
};

const isValidEsewaPaymentUrl = (value) => {
    if (!value) return false;
    try {
        const parsed = new URL(String(value).trim());
        const host = parsed.hostname.toLowerCase();
        return (
            (host === 'rc-epay.esewa.com.np' || host === 'epay.esewa.com.np') &&
            (parsed.protocol === 'https:' || parsed.protocol === 'http:')
        );
    } catch (err) {
        return false;
    }
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

const getRequestBaseUrl = (req) => {
    const configured = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    if (configured) return configured;
    return `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
};

const resolveConfiguredLocalBaseUrl = (configuredUrl, req) => {
    if (!configuredUrl) return '';
    try {
        const parsed = new URL(configuredUrl);
        const requestHost = req.get('host') || '';
        const configuredHost = parsed.host.toLowerCase();
        const requestHostLower = requestHost.toLowerCase();
        if (
            (configuredHost.startsWith('localhost') || configuredHost.startsWith('127.0.0.1') || configuredHost.startsWith('[::1]')) &&
            requestHostLower &&
            configuredHost !== requestHostLower
        ) {
            return `${parsed.protocol}//${requestHost}`;
        }
        return configuredUrl;
    } catch (err) {
        return configuredUrl;
    }
};

const getFrontendBaseUrl = (req) => {
    const configured = (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    return resolveConfiguredLocalBaseUrl(configured, req) || getRequestBaseUrl(req);
};

const getBackendBaseUrl = (req) => {
    const configured = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
    return resolveConfiguredLocalBaseUrl(configured, req) || getRequestBaseUrl(req);
};

const getAlreadyBookedCount = async (eventId, userEmail) => {
    const alreadyAgg = await Booking.aggregate([
        {
            $match: {
                eventId,
                userEmail,
                status: { $nin: ['cancelled', 'expired'] }
            }
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$ticketCount', 1] } } } }
    ]);
    return alreadyAgg.length > 0 ? alreadyAgg[0].total : 0;
};

const ensureCapacityAvailable = async (event, ticketCount) => {
    if (!event.maxCapacity || event.maxCapacity <= 0) {
        return null;
    }

    const seatAgg = await Booking.aggregate([
        { $match: { eventId: event._id, status: { $nin: ['cancelled', 'expired'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$ticketCount', 1] } } } }
    ]);
    const bookedSeats = seatAgg.length > 0 ? seatAgg[0].total : 0;
    if (bookedSeats + ticketCount > event.maxCapacity) {
        return `Only ${Math.max(event.maxCapacity - bookedSeats, 0)} seats left for this event`;
    }
    return null;
};

const saveUserBookingState = async (user, event, ticketCount) => {
    if (!Array.isArray(user.bookedEvents)) {
        user.bookedEvents = [];
    }

    const eventId = event._id.toString();
    if (!user.bookedEvents.some(id => id.toString() === eventId)) {
        user.bookedEvents.push(event._id);
    }
    if (!Array.isArray(user.notifications)) {
        user.notifications = [];
    }

    user.notifications.unshift({
        type: 'booking_confirmed',
        eventId: event._id,
        eventName: pickEventName(event),
        ticketCount,
        createdAt: new Date()
    });
    if (user.notifications.length > 20) {
        user.notifications = user.notifications.slice(0, 20);
    }
    await user.save();
};

const createConfirmedBooking = async ({ event, user, attendeeEmail, ticketCount, attendeeNames }) => {
    const unitPrice = typeof event.ticketPrice === 'number' ? event.ticketPrice : 0;
    const totalAmount = unitPrice * ticketCount;
    const alreadyBooked = await getAlreadyBookedCount(event._id, user.email);
    const ref_num = createRef();
    const ticketCodes = buildTicketCodes(ref_num, 1, ticketCount);
    const booking = await Booking.create({
        eventId: event._id,
        userName: attendeeNames[0],
        userEmail: user.email,
        attendeeEmail,
        attendeeNames,
        ticketCount,
        unitPrice,
        totalAmount,
        ticketCodes,
        referenceNumber: ref_num,
        bookingRef: ref_num,
        status: 'confirmed'
    });

    await saveUserBookingState(user, event, ticketCount);
    return { booking, alreadyBooked: alreadyBooked + ticketCount };
};

const prepareBookingCheckout = async ({ userId, eventId, email, ticketCountRaw, attendeeNamesRaw }) => {
    const ticketCountValue = typeof ticketCountRaw === 'string' ? ticketCountRaw.trim() : String(ticketCountRaw || '').trim();
    const ticketCount = Number(ticketCountValue);
    const emailValue = (email || '').trim().toLowerCase();
    const attendeeNames = normalizeAttendeeNames(attendeeNamesRaw);
    const emailPattern = /^[^\s@]*[A-Za-z][^\s@]*@[^\s@]+\.[^\s@]+$/;

    if (!emailValue) {
        throw createHttpError(400, 'Please enter your email address.');
    }
    if (!emailPattern.test(emailValue)) {
        throw createHttpError(400, 'Please enter a valid email address with at least one letter before @.');
    }
    if (!/^[1-9]\d*$/.test(ticketCountValue) || !Number.isInteger(ticketCount)) {
        throw createHttpError(400, 'Please enter a valid number of tickets.');
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw createHttpError(400, 'Invalid event. Please reload the page.');
    }
    if (ticketCount > MAX_TICKETS_PER_BOOKING) {
        throw createHttpError(400, `Maximum ${MAX_TICKETS_PER_BOOKING} tickets per booking. If you want more, buy again.`);
    }
    if (attendeeNames.length !== ticketCount || attendeeNames.some(name => !name)) {
        throw createHttpError(400, `Please enter attendee full name for all ${ticketCount} ticket${ticketCount === 1 ? '' : 's'}.`);
    }
    if (attendeeNames.some(name => name.length < 3)) {
        throw createHttpError(400, 'Each attendee full name must be at least 3 characters.');
    }
    if (attendeeNames.some(name => !attendeeNamePattern.test(name))) {
        throw createHttpError(400, 'Attendee names can contain letters and single spaces only.');
    }
    const uniqueNames = new Set(attendeeNames.map(name => name.toLowerCase()));
    if (uniqueNames.size !== attendeeNames.length) {
        throw createHttpError(400, 'Please enter a different attendee name for each ticket.');
    }

    const event = await Event.findById(eventId);
    if (!event) {
        throw createHttpError(404, 'Event not found');
    }
    if (isEventDatePassed(event)) {
        throw createHttpError(400, 'Booking closed. This event date has passed.');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw createHttpError(404, 'User not found');
    }

    const capacityMessage = await ensureCapacityAvailable(event, ticketCount);
    if (capacityMessage) {
        throw createHttpError(400, capacityMessage);
    }

    const unitPrice = typeof event.ticketPrice === 'number' ? event.ticketPrice : 0;
    const totalAmount = unitPrice * ticketCount;

    return {
        event,
        user,
        attendeeEmail: emailValue,
        attendeeNames,
        ticketCount,
        unitPrice,
        totalAmount
    };
};

const getPaymentCheckouts = (req) => {
    if (!req.session.paymentCheckouts) {
        req.session.paymentCheckouts = {};
    }
    return req.session.paymentCheckouts;
};

const getWalletPaymentCheckouts = (req) => {
    if (!req.session.walletPaymentCheckouts) {
        req.session.walletPaymentCheckouts = {};
    }
    return req.session.walletPaymentCheckouts;
};

const normalizeWalletPhone = (value) => {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (digits.startsWith('977') && digits.length === 12) {
        return digits.slice(3);
    }
    return digits;
};

const findWalletCheckout = (req, transactionUuid) => {
    const walletCheckouts = req.session.walletPaymentCheckouts || {};
    if (walletCheckouts[transactionUuid]) {
        return {
            source: 'event',
            checkout: walletCheckouts[transactionUuid]
        };
    }

    const venueCheckouts = req.session.venuePaymentCheckouts || {};
    const venueCheckout = venueCheckouts[transactionUuid];
    if (venueCheckout && venueCheckout.paymentProvider === 'wallet') {
        return {
            source: 'venue',
            checkout: venueCheckout
        };
    }

    return null;
};

const removeWalletCheckout = (req, source, transactionUuid) => {
    if (source === 'event') {
        const walletCheckouts = req.session.walletPaymentCheckouts || {};
        delete walletCheckouts[transactionUuid];
        req.session.walletPaymentCheckouts = walletCheckouts;
        return;
    }
    if (source === 'venue') {
        const venueCheckouts = req.session.venuePaymentCheckouts || {};
        delete venueCheckouts[transactionUuid];
        req.session.venuePaymentCheckouts = venueCheckouts;
    }
};

const decodeEsewaDataPayload = (encoded) => {
    const raw = String(encoded || '').trim();
    if (!raw) return null;

    try {
        // eSewa may send URL-safe base64 without padding.
        const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
        return null;
    }
};

exports.createBooking = async (req, res) => {
    try {
        const {
            event,
            user,
            attendeeEmail,
            attendeeNames,
            ticketCount,
            totalAmount
        } = await prepareBookingCheckout({
            userId: req.user.userId,
            eventId: req.body.eventId,
            email: req.body.email,
            ticketCountRaw: req.body.ticketCount,
            attendeeNamesRaw: req.body.attendeeNames
        });

        if (totalAmount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Use the eSewa payment button to complete paid bookings.'
            });
        }

        // Each checkout is its own booking, while My Bookings groups same-event rows.
        const { booking, alreadyBooked } = await createConfirmedBooking({
            event,
            user,
            attendeeEmail,
            ticketCount,
            attendeeNames
        });

    res.json({
        success: true,
        message: 'Booking confirmed!',
        referenceNumber: booking.referenceNumber,
        ticketCount: booking.ticketCount,
        totalAmount: booking.totalAmount,
        bookingId: booking._id,
        ticketCodes: booking.ticketCodes,
        attendeeNames: booking.attendeeNames,
        alreadyBooked
    });

    } catch (err) {
        console.error('Booking Error:', err);
        if (err && err.status) {
            return res.status(err.status).json({
                success: false,
                message: err.message
            });
        }
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

exports.initiateEsewaPayment = async (req, res) => {
    try {
        const checkout = await prepareBookingCheckout({
            userId: req.user.userId,
            eventId: req.body.eventId,
            email: req.body.email,
            ticketCountRaw: req.body.ticketCount,
            attendeeNamesRaw: req.body.attendeeNames
        });

        if (checkout.totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'eSewa can only be used for paid bookings.'
            });
        }

        const purchaseOrderId = String(req.body.orderId || `ESW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).trim();
        const purchaseOrderName = String(req.body.orderName || pickEventName(checkout.event)).trim() || 'EMS Event Booking';
        const transactionUuid = purchaseOrderId;
        const successUrl = `${getFrontendBaseUrl(req)}/payments/esewa/success/${encodeURIComponent(transactionUuid)}`;
        const failureUrl = `${getFrontendBaseUrl(req)}/payments/esewa/success/${encodeURIComponent(transactionUuid)}`;
        const totalAmount = toEsewaAmount(checkout.totalAmount);

        const esewaPayload = buildEsewaPaymentPayload({
            amount: totalAmount,
            transactionUuid,
            successUrl,
            failureUrl
        });
        const paymentUrl = ESEWA_FORM_URL;
        if (!isValidEsewaPaymentUrl(paymentUrl)) {
            return res.status(500).json({
                success: false,
                message: 'eSewa returned an invalid payment URL.'
            });
        }
        const expiresAt = Date.now() + PAYMENT_CHECKOUT_TTL_MS;

        const checkouts = getPaymentCheckouts(req);
        checkouts[transactionUuid] = {
            transactionUuid,
            purchaseOrderId,
            purchaseOrderName,
            eventId: checkout.event._id.toString(),
            userId: checkout.user._id.toString(),
            attendeeEmail: checkout.attendeeEmail,
            attendeeNames: checkout.attendeeNames,
            ticketCount: checkout.ticketCount,
            unitPrice: checkout.unitPrice,
            totalAmount: checkout.totalAmount,
            amountPaisa: Math.round(totalAmount * 100),
            status: 'Initiated',
            paymentUrl,
            productCode: ESEWA_PRODUCT_CODE,
            createdAt: Date.now(),
            expiresAt
        };
        req.session.paymentCheckouts = checkouts;

        return req.session.save(() => res.json({
            success: true,
            paymentProvider: 'esewa',
            payment_url: paymentUrl,
            form_fields: esewaPayload,
            transaction_uuid: transactionUuid,
            expires_at: new Date(expiresAt).toISOString(),
            expires_in: Math.max(Math.ceil((expiresAt - Date.now()) / 1000), 1)
        }));
    } catch (err) {
        console.error('eSewa Initiate Error:', err);
        const statusCode = err.status || 500;
        const message = err.message || 'Unable to start eSewa checkout.';

        return res.status(statusCode).json({
            success: false,
            message,
            details: err.payload || undefined
        });
    }
};

exports.initiateWalletPayment = async (req, res) => {
    try {
        const checkout = await prepareBookingCheckout({
            userId: req.user.userId,
            eventId: req.body.eventId,
            email: req.body.email,
            ticketCountRaw: req.body.ticketCount,
            attendeeNamesRaw: req.body.attendeeNames
        });

        if (checkout.totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'EMS Wallet is only required for paid bookings.'
            });
        }

        const transactionUuid = `EWL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const expiresAt = Date.now() + PAYMENT_CHECKOUT_TTL_MS;
        const checkouts = getWalletPaymentCheckouts(req);
        checkouts[transactionUuid] = {
            transactionUuid,
            paymentProvider: 'wallet',
            bookingType: 'event',
            purchaseOrderName: String(req.body.orderName || pickEventName(checkout.event)).trim() || 'EMS Event Booking',
            eventId: checkout.event._id.toString(),
            userId: checkout.user._id.toString(),
            attendeeEmail: checkout.attendeeEmail,
            attendeeNames: checkout.attendeeNames,
            ticketCount: checkout.ticketCount,
            unitPrice: checkout.unitPrice,
            totalAmount: checkout.totalAmount,
            status: 'Initiated',
            createdAt: Date.now(),
            expiresAt
        };
        req.session.walletPaymentCheckouts = checkouts;

        return req.session.save(() => res.json({
            success: true,
            paymentProvider: 'wallet',
            transaction_uuid: transactionUuid,
            redirect_url: `/payments/wallet/${encodeURIComponent(transactionUuid)}?bookingType=event`,
            expires_at: new Date(expiresAt).toISOString(),
            expires_in: Math.max(Math.ceil((expiresAt - Date.now()) / 1000), 1)
        }));
    } catch (err) {
        console.error('EMS Wallet Initiate Error:', err);
        const statusCode = err.status || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Unable to start EMS Wallet checkout.'
        });
    }
};

exports.getWalletPaymentPage = async (req, res) => {
    const transactionUuid = String(req.params.transactionUuid || req.query.transaction_uuid || '').trim();
    if (!transactionUuid) {
        return res.redirect('/bookings');
    }

    const match = findWalletCheckout(req, transactionUuid);
    if (!match) {
        return res.redirect('/payments/success?provider=esewa&status=expired&eventName=EMS%20Wallet');
    }

    const { source, checkout } = match;
    if (checkout.expiresAt && Date.now() > checkout.expiresAt) {
        if (source === 'venue' && checkout.venueBookingId) {
            await VenueBooking.findByIdAndUpdate(checkout.venueBookingId, {
                $set: {
                    status: 'cancelled',
                    paymentStatus: 'unpaid'
                }
            });
        }
        removeWalletCheckout(req, source, transactionUuid);
        return req.session.save(() => res.redirect('/payments/success?provider=esewa&status=expired&eventName=EMS%20Wallet'));
    }

    let targetName = source === 'event'
        ? (checkout.purchaseOrderName || 'Event Booking')
        : 'Venue Booking';
    let paymentDetails = [];

    if (source === 'event') {
        const event = await Event.findById(checkout.eventId)
            .select('eventName title name eventTitle startDate endDate startTime endTime location')
            .lean();
        if (event) {
            targetName = pickEventName(event, targetName);
            paymentDetails = [
                { label: 'Booking Type', value: 'Event' },
                { label: 'Tickets', value: String(checkout.ticketCount || 1) },
                { label: 'Date', value: event.startDate ? new Date(event.startDate).toLocaleDateString('en-US') : 'N/A' },
                { label: 'Time', value: (event.startTime && event.endTime) ? `${event.startTime} - ${event.endTime}` : (event.startTime || 'N/A') },
                { label: 'Location', value: event.location || 'N/A' }
            ];
        } else {
            paymentDetails = [
                { label: 'Booking Type', value: 'Event' },
                { label: 'Tickets', value: String(checkout.ticketCount || 1) }
            ];
        }
    } else if (checkout.venueBookingId) {
        const venueBooking = await VenueBooking.findById(checkout.venueBookingId).populate('venueId').lean();
        if (venueBooking && venueBooking.venueId && venueBooking.venueId.name) {
            targetName = venueBooking.venueId.name;
        }
        if (venueBooking) {
            paymentDetails = [
                { label: 'Booking Type', value: 'Venue' },
                { label: 'Start Date', value: venueBooking.startDate ? new Date(venueBooking.startDate).toLocaleDateString('en-US') : 'N/A' },
                { label: 'Start Time', value: venueBooking.startTime || 'N/A' },
                { label: 'End Date', value: venueBooking.endDate ? new Date(venueBooking.endDate).toLocaleDateString('en-US') : 'N/A' },
                { label: 'End Time', value: venueBooking.endTime || 'N/A' }
            ];
        }
    }

    return res.render('emsWallet', {
        bookingType: source === 'venue' ? 'venue' : 'event',
        transactionUuid,
        paymentTargetName: targetName,
        amount: Number(checkout.totalAmount || 0),
        expiresAt: checkout.expiresAt || null,
        paymentDetails
    });
};

exports.precheckWalletCredentials = async (req, res) => {
    try {
        const transactionUuid = String(req.body.transaction_uuid || '').trim();
        const phoneNumber = normalizeWalletPhone(req.body.phoneNumber);
        const pin = String(req.body.pin || '').trim();

        if (!transactionUuid) {
            return res.status(400).json({ success: false, message: 'Missing EMS Wallet transaction identifier.' });
        }
        const match = findWalletCheckout(req, transactionUuid);
        if (!match) {
            return res.status(404).json({ success: false, message: 'EMS Wallet session expired. Please book again.' });
        }
        const { source, checkout } = match;
        if (checkout.expiresAt && Date.now() > checkout.expiresAt) {
            if (source === 'venue' && checkout.venueBookingId) {
                await VenueBooking.findByIdAndUpdate(checkout.venueBookingId, {
                    $set: {
                        status: 'cancelled',
                        paymentStatus: 'unpaid'
                    }
                });
            }
            removeWalletCheckout(req, source, transactionUuid);
            return req.session.save(() => res.status(410).json({
                success: false,
                message: 'The EMS Wallet session expired. Please start booking again.'
            }));
        }

        if (!phoneNumber || !pin) {
            return res.status(400).json({ success: false, message: 'Please enter both phone number and PIN.' });
        }
        if (phoneNumber !== EMS_WALLET_TEST_PHONE || pin !== EMS_WALLET_TEST_PIN) {
            return res.status(400).json({ success: false, message: 'Invalid wallet phone number or PIN.' });
        }

        return res.json({ success: true, message: 'Phone and PIN verified.' });
    } catch (err) {
        console.error('EMS Wallet Precheck Error:', err);
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Unable to verify wallet credentials.'
        });
    }
};

exports.verifyWalletPayment = async (req, res) => {
    try {
        const transactionUuid = String(req.body.transaction_uuid || '').trim();
        const phoneNumber = normalizeWalletPhone(req.body.phoneNumber);
        const pin = String(req.body.pin || '').trim();
        const otp = String(req.body.otp || '').trim();

        if (!transactionUuid) {
            return res.status(400).json({ success: false, message: 'Missing EMS Wallet transaction identifier.' });
        }

        const match = findWalletCheckout(req, transactionUuid);
        if (!match) {
            return res.status(404).json({ success: false, message: 'EMS Wallet session expired. Please book again.' });
        }

        const { source, checkout } = match;
        if (checkout.expiresAt && Date.now() > checkout.expiresAt) {
            if (source === 'venue' && checkout.venueBookingId) {
                await VenueBooking.findByIdAndUpdate(checkout.venueBookingId, {
                    $set: {
                        status: 'cancelled',
                        paymentStatus: 'unpaid'
                    }
                });
            }
            removeWalletCheckout(req, source, transactionUuid);
            return req.session.save(() => res.status(410).json({
                success: false,
                message: 'The EMS Wallet session expired. Please start booking again.'
            }));
        }

        if (!phoneNumber || !pin) {
            return res.status(400).json({ success: false, message: 'Please enter both phone number and PIN.' });
        }
        if (phoneNumber !== EMS_WALLET_TEST_PHONE || pin !== EMS_WALLET_TEST_PIN) {
            return res.status(400).json({ success: false, message: 'Invalid wallet phone number or PIN.' });
        }
        if (!otp) {
            return res.status(400).json({ success: false, message: 'Please enter OTP to continue.' });
        }
        if (otp !== EMS_WALLET_TEST_OTP) {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }

        if (source === 'event') {
            let bookingId = checkout.bookingId || null;
            let eventName = checkout.purchaseOrderName || 'Event Booking';

            if (!bookingId) {
                const [event, user] = await Promise.all([
                    Event.findById(checkout.eventId),
                    User.findById(checkout.userId)
                ]);

                if (!event || !user) {
                    throw createHttpError(404, 'Booking details were not found for EMS Wallet payment.');
                }
                if (isEventDatePassed(event)) {
                    throw createHttpError(400, 'Booking closed. This event date has passed.');
                }
                const capacityMessage = await ensureCapacityAvailable(event, checkout.ticketCount);
                if (capacityMessage) {
                    throw createHttpError(400, capacityMessage);
                }

                const { booking } = await createConfirmedBooking({
                    event,
                    user,
                    attendeeEmail: checkout.attendeeEmail,
                    ticketCount: checkout.ticketCount,
                    attendeeNames: checkout.attendeeNames
                });
                bookingId = booking._id.toString();
                eventName = pickEventName(event, eventName);
            }

            removeWalletCheckout(req, source, transactionUuid);
            return req.session.save(() => res.json({
                success: true,
                message: 'EMS Wallet payment successful.',
                redirectUrl: `/payments/success?provider=free&bookingType=event&bookingId=${encodeURIComponent(bookingId || '')}&eventName=${encodeURIComponent(eventName)}`
            }));
        }

        const venueBooking = await VenueBooking.findById(checkout.venueBookingId).populate('venueId');
        if (!venueBooking) {
            removeWalletCheckout(req, source, transactionUuid);
            return req.session.save(() => res.status(404).json({
                success: false,
                message: 'Venue booking was not found for this wallet payment.'
            }));
        }

        venueBooking.status = 'confirmed';
        venueBooking.paymentStatus = 'paid';
        await venueBooking.save();

        const venueName = encodeURIComponent(
            (venueBooking.venueId && venueBooking.venueId.name)
                ? venueBooking.venueId.name
                : 'Venue Booking'
        );
        removeWalletCheckout(req, source, transactionUuid);
        return req.session.save(() => res.json({
            success: true,
            message: 'EMS Wallet payment successful.',
            redirectUrl: `/payments/success?provider=free&bookingType=venue&bookingId=${encodeURIComponent(venueBooking._id.toString())}&eventName=${venueName}`
        }));
    } catch (err) {
        console.error('EMS Wallet Verify Error:', err);
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Unable to verify EMS Wallet payment.'
        });
    }
};

exports.getPaymentSuccessPage = (req, res) => {
    const provider = String(req.query.provider || 'esewa').trim().toLowerCase() === 'free' ? 'free' : 'esewa';
    const esewaData = decodeEsewaDataPayload(req.query.data);
    const transactionUuid = String(
        req.params.transactionUuid
        || req.query.transaction_uuid
        || req.query.pidx
        || (esewaData && (esewaData.transaction_uuid || esewaData.transaction_code))
        || ''
    ).trim();
    const checkouts = req.session.paymentCheckouts || {};
    const checkout = provider === 'esewa' && transactionUuid ? checkouts[transactionUuid] : null;
    return res.render('esewaSuccess', {
        provider,
        pidx: transactionUuid,
        bookingId: String(req.query.bookingId || (checkout && checkout.bookingId) || '').trim(),
        bookingType: String(req.query.bookingType || 'event').trim().toLowerCase(),
        eventName: checkout && checkout.purchaseOrderName
            ? String(checkout.purchaseOrderName)
            : String(req.query.eventName || '').trim(),
        callbackStatus: String(req.query.status || '').trim(),
        expiresAt: checkout && checkout.expiresAt ? checkout.expiresAt : null,
        frontendBaseUrl: getFrontendBaseUrl(req),
        backendBaseUrl: getBackendBaseUrl(req)
    });
};

exports.getKhaltiSuccessPage = exports.getPaymentSuccessPage;
exports.getEsewaSuccessPage = exports.getPaymentSuccessPage;

exports.verifyEsewaPayment = async (req, res) => {
    try {
        const transactionUuid = String(req.body.transaction_uuid || req.body.pidx || '').trim();
        if (!transactionUuid) {
            return res.status(400).json({
                success: false,
                message: 'Missing eSewa transaction identifier.'
            });
        }

        const checkouts = req.session.paymentCheckouts || {};
        const checkout = checkouts[transactionUuid];
        if (!checkout) {
            return res.status(404).json({
                success: false,
                message: 'eSewa payment session expired. Please try booking again.'
            });
        }

        if (checkout.expiresAt && Date.now() > checkout.expiresAt) {
            delete checkouts[transactionUuid];
            req.session.paymentCheckouts = checkouts;
            return req.session.save(() => res.status(410).json({
                success: false,
                status: 'Expired',
                expiresAt: checkout.expiresAt,
                message: 'The 30-minute booking window expired. Please start the payment again.'
            }));
        }

        const lookupResponse = await lookupEsewaPayment({
            transactionUuid,
            totalAmount: checkout.totalAmount,
            productCode: checkout.productCode || ESEWA_PRODUCT_CODE
        });
        const status = String(lookupResponse.status || 'PENDING').trim().toUpperCase();

        if (status === 'COMPLETE' || status === 'COMPLETED') {
            if (checkout.bookingId) {
                checkout.status = status;
                checkout.lookup = lookupResponse;
                checkout.verifiedAt = Date.now();
                req.session.paymentCheckouts = checkouts;
                return req.session.save(() => res.json({
                    success: true,
                    status,
                    bookingId: checkout.bookingId,
                    expiresAt: checkout.expiresAt,
                    redirectUrl: `/bookings/manage/${checkout.bookingId}`
                }));
            }

            const [event, user] = await Promise.all([
                Event.findById(checkout.eventId),
                User.findById(checkout.userId)
            ]);

            if (!event || !user) {
                throw createHttpError(404, 'Booking details were not found after eSewa payment.');
            }
            if (isEventDatePassed(event)) {
                throw createHttpError(400, 'Booking closed. This event date has passed.');
            }

            const capacityMessage = await ensureCapacityAvailable(event, checkout.ticketCount);
            if (capacityMessage) {
                throw createHttpError(400, capacityMessage);
            }

            const { booking } = await createConfirmedBooking({
                event,
                user,
                attendeeEmail: checkout.attendeeEmail,
                ticketCount: checkout.ticketCount,
                attendeeNames: checkout.attendeeNames
            });

            checkout.bookingId = booking._id.toString();
            checkout.status = status;
            checkout.lookup = lookupResponse;
            checkout.verifiedAt = Date.now();
            req.session.paymentCheckouts = checkouts;

            return req.session.save(() => res.json({
                success: true,
                status,
                bookingId: booking._id,
                expiresAt: checkout.expiresAt,
                redirectUrl: `/bookings/manage/${booking._id}`
            }));
        }

        checkout.status = status;
        checkout.lookup = lookupResponse;
        req.session.paymentCheckouts = checkouts;

        return req.session.save(() => res.json({
            success: status === 'PENDING',
            status,
            bookingId: checkout.bookingId || null,
            expiresAt: checkout.expiresAt,
            redirectUrl: checkout.bookingId ? `/bookings/manage/${checkout.bookingId}` : null,
            message: status === 'PENDING'
                ? 'eSewa payment is still pending.'
                : 'eSewa payment was not completed.'
        }));
    } catch (err) {
        console.error('eSewa Verify Error:', err);
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Unable to verify eSewa payment.',
            status: err.payload && err.payload.status ? err.payload.status : undefined,
            details: err.payload || undefined
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

        // 1. Fetch Event Bookings
        let eventBookings = await Booking.find({
            userEmail: user.email,
            status: { $in: ['confirmed', 'cancelled', 'expired'] }
        })
            .populate('eventId')
            .sort({ createdAt: -1 });

        await syncBookingsExpiry(eventBookings);

        eventBookings = eventBookings
            .filter(booking => booking.eventId)
            .map(booking => {
                const b = booking.toObject ? booking.toObject() : { ...booking };
                const ticketCount = b.ticketCount || 1;
                const unitPrice = typeof b.unitPrice === 'number'
                    ? b.unitPrice
                    : (b.eventId && typeof b.eventId.ticketPrice === 'number' ? b.eventId.ticketPrice : 0);
                b.ticketCount = ticketCount;
                b.unitPrice = unitPrice;
                b.totalAmount = typeof b.totalAmount === 'number'
                    ? b.totalAmount
                    : unitPrice * ticketCount;
                b.bookingType = 'event';
                return b;
            });

        // 2. Fetch Venue Bookings
        let venueBookings = await VenueBooking.find({
            userId: user._id,
            status: { $in: ['confirmed', 'cancelled', 'expired'] }
        })
            .populate('venueId')
            .sort({ createdAt: -1 });

        venueBookings = venueBookings
            .filter(booking => booking.venueId)
            .map(booking => {
                const b = booking.toObject ? booking.toObject() : { ...booking };
                b.bookingType = 'venue';
                // For sorting/compatibility
                b.createdAt = b.createdAt || new Date();
                return b;
            });

        // 3. Merge and Sort
        let allBookings = [...eventBookings, ...venueBookings].sort((a, b) => {
            const dateA = a.bookingType === 'event' ? (a.eventId ? a.eventId.startDate : a.createdAt) : a.startDate;
            const dateB = b.bookingType === 'event' ? (b.eventId ? b.eventId.startDate : b.createdAt) : b.startDate;
            return new Date(dateB) - new Date(dateA);
        });

        // Optional: Group event bookings (keeping the logic from before for event bookings)
        // Note: The user might want both types to be grouped or just list them.
        // For simplicity and to match the "My Venue Bookings" separate view which was a list, 
        // I will just pass the combined list but I'll keep the grouping logic if possible or just use the list.
        // The original code grouped event bookings by eventId and status. 
        // Let's keep that but only for 'event' types.

        const groupedBookings = [];
        const groupedByEventAndStatus = new Map();

        for (const booking of allBookings) {
            if (booking.bookingType === 'event') {
                const status = (booking.status || 'confirmed').toLowerCase();
                const safeStatus = ['cancelled', 'expired'].includes(status) ? status : 'confirmed';
                const eventId = booking.eventId && booking.eventId._id ? booking.eventId._id.toString() : String(booking.eventId);
                const key = `${safeStatus}:${eventId}`;
                
                if (!groupedByEventAndStatus.has(key)) {
                    booking.status = safeStatus;
                    booking.references = [booking.referenceNumber].filter(Boolean);
                    booking.ticketCodes = Array.isArray(booking.ticketCodes) ? [...booking.ticketCodes] : [];
                    groupedByEventAndStatus.set(key, booking);
                    groupedBookings.push(booking);
                } else {
                    const group = groupedByEventAndStatus.get(key);
                    group.ticketCount += booking.ticketCount;
                    group.totalAmount += booking.totalAmount;
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
            } else {
                // Venue bookings - just add them directly for now as they aren't grouped in the model usually
                groupedBookings.push(booking);
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
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.redirect('/bookings');
        }

        const forceViewOnly = String(req.query.viewOnly || '').trim() === '1';
        const groupedRequested = String(req.query.grouped || '').trim() === '1';
        const groupedEventId = String(req.query.eventId || '').trim();

        const booking = await Booking.findById(req.params.bookingId).populate('eventId');
        if (booking && booking.eventId) {
            await syncBookingExpiry(booking);

            if (booking.userEmail !== user.email) {
                return res.redirect('/bookings');
            }

            if (groupedRequested && mongoose.Types.ObjectId.isValid(groupedEventId)) {
                let groupedBookings = await Booking.find({
                    eventId: groupedEventId,
                    userEmail: user.email,
                    status: { $nin: ['cancelled', 'expired'] }
                }).populate('eventId').sort({ createdAt: -1 });

                await syncBookingsExpiry(groupedBookings);
                groupedBookings = groupedBookings.filter((item) => {
                    const status = String(item.status || '').toLowerCase();
                    return status !== 'cancelled' && status !== 'expired' && item.eventId;
                });

                if (groupedBookings.length > 0) {
                    const primary = groupedBookings[0];
                    const primaryObj = primary.toObject ? primary.toObject() : { ...primary };
                    const totalTickets = groupedBookings.reduce((sum, item) => sum + Math.max(item.ticketCount || 1, 1), 0);
                    const totalAmount = groupedBookings.reduce((sum, item) => {
                        const count = Math.max(item.ticketCount || 1, 1);
                        const unitPrice = typeof item.unitPrice === 'number'
                            ? item.unitPrice
                            : (item.eventId && typeof item.eventId.ticketPrice === 'number' ? item.eventId.ticketPrice : 0);
                        return sum + (typeof item.totalAmount === 'number' ? item.totalAmount : unitPrice * count);
                    }, 0);

                    const mergedTicketCodes = [];
                    const mergedAttendeeNames = [];
                    for (const item of groupedBookings) {
                        const currentCount = Math.max(item.ticketCount || 1, 1);
                        let itemCodes = Array.isArray(item.ticketCodes) ? [...item.ticketCodes] : [];
                        const itemNamesRaw = Array.isArray(item.attendeeNames) ? item.attendeeNames : [];
                        const itemNames = Array.from(
                            { length: currentCount },
                            (_, idx) => normalizeAttendeeName(String(itemNamesRaw[idx] || (idx === 0 ? (item.userName || '') : '')))
                        );
                        if (itemCodes.length < currentCount) {
                            const refNum = item.referenceNumber || createRef();
                            const startIndex = itemCodes.length + 1;
                            itemCodes = [...itemCodes, ...buildTicketCodes(refNum, startIndex, currentCount - itemCodes.length)];
                            item.referenceNumber = item.referenceNumber || refNum;
                            item.bookingRef = item.bookingRef || refNum;
                            item.ticketCodes = itemCodes;
                            await item.save();
                        }
                        mergedTicketCodes.push(...itemCodes.slice(0, currentCount));
                        mergedAttendeeNames.push(...itemNames.slice(0, currentCount));
                    }

                    primaryObj.ticketCount = totalTickets;
                    primaryObj.totalAmount = totalAmount;
                    primaryObj.isGroupedBooking = true;
                    primaryObj.groupedEventId = groupedEventId;
                    primaryObj.ticketCodes = mergedTicketCodes;
                    primaryObj.attendeeNames = mergedAttendeeNames;

                    return res.render("manageBooking", {
                        booking: primaryObj,
                        user,
                        publicBaseUrl: getPublicBaseUrl(req),
                        forceViewOnly
                    });
                }
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

            return res.render("manageBooking", {
                booking,
                user,
                publicBaseUrl: getPublicBaseUrl(req),
                forceViewOnly
            });
        }

        const venueBooking = await VenueBooking.findById(req.params.bookingId).populate('venueId');
        if (!venueBooking || !venueBooking.venueId) {
            return res.status(404).render("404", { title: "404 - Page Not Found" });
        }
        if (String(venueBooking.userId) !== String(user._id)) {
            return res.redirect('/bookings');
        }

        return res.render("manageVenueBooking", {
            booking: venueBooking,
            venue: venueBooking.venueId,
            user,
            publicBaseUrl: getPublicBaseUrl(req),
            forceViewOnly
        });
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
            attendeeName: attendeeNames[ticketIndex] || booking.userName || "-",
            attendeeEmail: booking.attendeeEmail || booking.userEmail || "-",
            date: eventDate,
            time: eventTime,
            location: event.location || booking.eventLocation || "TBA",
            price: unitPrice === 0 ? "Free" : `NPR. ${unitPrice % 1 === 0 ? unitPrice.toFixed(0) : unitPrice.toFixed(2)}`,
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

exports.getVenueTicketDetails = async (req, res) => {
    try {
        const referenceNumber = decodeURIComponent(req.params.referenceNumber || '').trim();
        if (!referenceNumber) {
            return res.status(404).render("404", { title: "Ticket Not Found" });
        }

        const booking = await VenueBooking.findOne({ referenceNumber }).populate('venueId').lean();
        if (!booking || !booking.venueId) {
            return res.status(404).render("404", { title: "Ticket Not Found" });
        }

        const venue = booking.venueId;
        const formatDateLabel = (value) => {
            if (!value) return "TBA";
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return "TBA";
            return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        };

        const startDate = formatDateLabel(booking.startDate);
        const endDate = formatDateLabel(booking.endDate);
        const bookingDate = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        const bookingTime = `${booking.startTime || "TBA"} - ${booking.endTime || "TBA"}`;
        const totalAmount = typeof booking.totalAmount === 'number' ? booking.totalAmount : 0;
        const totalDisplay = totalAmount === 0 ? "Free" : `NPR. ${totalAmount % 1 === 0 ? totalAmount.toFixed(0) : totalAmount.toFixed(2)}`;

        const ticket = {
            venueName: venue.name || "Venue",
            status: (booking.status || "confirmed").toUpperCase(),
            date: bookingDate,
            time: bookingTime,
            location: venue.location || "TBA",
            phone: booking.phoneNumber || "-",
            total: totalDisplay,
            reference: booking.referenceNumber || "-",
            bookedOn: booking.createdAt
                ? new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                : "TBA"
        };

        return res.render("venueTicketDetails", { ticket });
    } catch (err) {
        console.error("Get Venue Ticket Details Error:", err);
        return res.status(500).render("404", { title: "Ticket Not Found" });
    }
};
