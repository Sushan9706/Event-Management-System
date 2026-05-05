const bcrypt = require('bcrypt');
const DummyWallet = require('../models/dummyWallet');
const {
    ESEWA_PRODUCT_CODE,
    buildEsewaSuccessPayload,
    encodeEsewaData,
    verifyEsewaResponseSignature
} = require('../config/esewa');

const PIN_PATTERN = /^\d{4}$/;
const ESEWA_ID_PATTERN = /^(97|98)\d{8}$/;
const PIN_SALT_ROUNDS = 10;

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const normalizeWalletNumber = (value = '') => String(value).replace(/\D/g, '');
const getPaymentSession = (req) => req.session.dummyEsewaPayment || null;
const getPendingRegistration = (req) => req.session.dummyEsewaPendingRegistration || null;
const toViewWallet = (wallet) => (wallet ? { esewaId: wallet.phoneNumber } : null);

const getSessionWallet = async (req) => {
    const walletNumber = req.session.dummyEsewaWallet && req.session.dummyEsewaWallet.esewaId;
    if (!walletNumber || !req.user || !req.user.userId) return null;
    return DummyWallet.findOne({ phoneNumber: walletNumber, userId: req.user.userId }).lean();
};

const renderAuth = async (req, res, options = {}) => {
    const payment = getPaymentSession(req);
    if (!payment) {
        req.flash('error', 'Dummy wallet payment session expired. Please start booking again.');
        return res.redirect('/bookings');
    }

    const wallet = options.wallet || await getSessionWallet(req);
    return res.render('dummyEsewa', {
        mode: options.mode || 'login',
        payment,
        wallet: toViewWallet(wallet),
        pendingRegistration: getPendingRegistration(req),
        isLoggedIn: Boolean(req.session.dummyEsewaLoggedIn && wallet),
        error: options.error || '',
        success: options.success || ''
    });
};

exports.start = (req, res) => {
    const {
        amount,
        total_amount,
        transaction_uuid,
        product_code,
        success_url,
        failure_url,
        signed_field_names,
        signature
    } = req.body;

    const payment = {
        amount,
        total_amount,
        transaction_uuid,
        product_code,
        success_url,
        failure_url,
        signed_field_names,
        signature
    };

    const validPayment = product_code === ESEWA_PRODUCT_CODE
        && total_amount
        && transaction_uuid
        && verifyEsewaResponseSignature(payment);

    if (!validPayment) {
        req.flash('error', 'Invalid dummy wallet payment request.');
        return res.redirect('/bookings');
    }

    req.session.dummyEsewaPayment = payment;
    req.session.dummyEsewaLoggedIn = false;
    return req.session.save(() => res.redirect('/dummy-esewa/auth'));
};

exports.auth = async (req, res) => renderAuth(req, res, { mode: 'login' });

exports.registerForm = async (req, res) => {
    if (req.query.reset === '1') {
        delete req.session.dummyEsewaPendingRegistration;
    }
    return renderAuth(req, res, { mode: 'register' });
};

exports.register = async (req, res) => {
    try {
        const esewaId = normalizeWalletNumber(req.body.esewaId);
        const pin = String(req.body.pin || '').trim();
        const otp = String(req.body.otp || '').trim();
        const pendingRegistration = getPendingRegistration(req);

        if (pendingRegistration && otp) {
            if (otp !== pendingRegistration.otp) {
                return renderAuth(req, res, {
                    mode: 'register',
                    error: 'OTP does not match. Enter the generated demo OTP.'
                });
            }

            const existingWallet = await DummyWallet.findOne({ phoneNumber: pendingRegistration.esewaId }).lean();
            if (existingWallet) {
                delete req.session.dummyEsewaPendingRegistration;
                return renderAuth(req, res, {
                    mode: 'login',
                    error: 'This phone number is already registered. Login with its PIN.'
                });
            }

            const pinHash = await bcrypt.hash(pendingRegistration.pin, PIN_SALT_ROUNDS);
            const wallet = await DummyWallet.create({
                userId: req.user.userId,
                phoneNumber: pendingRegistration.esewaId,
                pinHash
            });

            req.session.dummyEsewaWallet = { esewaId: wallet.phoneNumber };
            req.session.dummyEsewaLoggedIn = true;
            delete req.session.dummyEsewaPendingRegistration;
            return req.session.save(() => res.redirect('/dummy-esewa/dashboard'));
        }

        if (!ESEWA_ID_PATTERN.test(esewaId)) {
            return renderAuth(req, res, {
                mode: 'register',
                error: 'Enter your own 10 digit phone number starting with 97 or 98.'
            });
        }
        if (!PIN_PATTERN.test(pin)) {
            return renderAuth(req, res, {
                mode: 'register',
                error: 'Create a 4 digit dummy PIN.'
            });
        }

        const existingWallet = await DummyWallet.findOne({ phoneNumber: esewaId }).lean();
        if (existingWallet) {
            return renderAuth(req, res, {
                mode: 'login',
                error: 'This phone number is already registered. Login with its PIN.'
            });
        }

        const generatedOtp = createOtp();
        req.session.dummyEsewaPendingRegistration = {
            esewaId,
            pin,
            otp: generatedOtp,
            createdAt: Date.now()
        };
        return req.session.save(() => renderAuth(req, res, {
            mode: 'register'
        }));
    } catch (err) {
        if (err && err.code === 11000) {
            return renderAuth(req, res, {
                mode: 'login',
                error: 'This phone number is already registered. Login with its PIN.'
            });
        }
        console.error('Dummy Wallet Register Error:', err);
        return renderAuth(req, res, {
            mode: 'register',
            error: 'Unable to register dummy wallet. Please try again.'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const esewaId = normalizeWalletNumber(req.body.esewaId);
        const pin = String(req.body.pin || '').trim();
        const wallet = await DummyWallet.findOne({ phoneNumber: esewaId, userId: req.user.userId });

        if (!wallet) {
            return renderAuth(req, res, {
                mode: 'register',
                error: 'Register this phone number first, then login with its PIN.'
            });
        }

        const pinMatches = await bcrypt.compare(pin, wallet.pinHash);
        if (!pinMatches) {
            return renderAuth(req, res, {
                mode: 'login',
                error: 'Wallet number or PIN does not match a registered dummy wallet.'
            });
        }

        req.session.dummyEsewaWallet = { esewaId: wallet.phoneNumber };
        req.session.dummyEsewaLoggedIn = true;
        return req.session.save(() => res.redirect('/dummy-esewa/dashboard'));
    } catch (err) {
        console.error('Dummy Wallet Login Error:', err);
        return renderAuth(req, res, {
            mode: 'login',
            error: 'Unable to login to dummy wallet. Please try again.'
        });
    }
};

exports.dashboard = async (req, res) => {
    const wallet = await getSessionWallet(req);
    if (!req.session.dummyEsewaLoggedIn || !wallet) {
        req.session.dummyEsewaLoggedIn = false;
        return renderAuth(req, res, {
            mode: 'login',
            error: 'Login with a registered dummy wallet before opening the dashboard.'
        });
    }
    return renderAuth(req, res, {
        mode: 'dashboard',
        wallet
    });
};

exports.pay = async (req, res) => {
    const payment = getPaymentSession(req);
    const wallet = await getSessionWallet(req);
    if (!payment || !req.session.dummyEsewaLoggedIn || !wallet) {
        req.flash('error', 'Dummy wallet payment session expired. Please start booking again.');
        return res.redirect('/bookings');
    }

    const payload = buildEsewaSuccessPayload({
        transactionUuid: payment.transaction_uuid,
        totalAmount: payment.total_amount
    });
    const successUrl = `${payment.success_url}${payment.success_url.includes('?') ? '&' : '?'}data=${encodeURIComponent(encodeEsewaData(payload))}`;

    delete req.session.dummyEsewaPayment;
    req.session.dummyEsewaLoggedIn = false;
    return req.session.save(() => res.redirect(successUrl));
};

exports.cancel = (req, res) => {
    const payment = getPaymentSession(req);
    const failureUrl = payment && payment.failure_url ? payment.failure_url : '/bookings';

    delete req.session.dummyEsewaPayment;
    req.session.dummyEsewaLoggedIn = false;
    return req.session.save(() => res.redirect(failureUrl));
};
