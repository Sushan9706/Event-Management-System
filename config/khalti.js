const KHALTI_ENV = String(process.env.KHALTI_ENV || 'sandbox').trim().toLowerCase();
const KHALTI_API_BASE_URL = (KHALTI_ENV === 'live'
    ? 'https://khalti.com/api/v2'
    : 'https://dev.khalti.com/api/v2'
).replace(/\/+$/, '');
const KHALTI_ALT_API_BASE_URL = (KHALTI_ENV === 'live'
    ? 'https://dev.khalti.com/api/v2'
    : 'https://khalti.com/api/v2'
).replace(/\/+$/, '');
const KHALTI_INITIATE_URL = `${KHALTI_API_BASE_URL}/epayment/initiate/`;
const KHALTI_LOOKUP_URL = `${KHALTI_API_BASE_URL}/epayment/lookup/`;
const KHALTI_ALT_INITIATE_URL = `${KHALTI_ALT_API_BASE_URL}/epayment/initiate/`;
const KHALTI_ALT_LOOKUP_URL = `${KHALTI_ALT_API_BASE_URL}/epayment/lookup/`;

const getKhaltiSecretKeyCandidates = () => {
    const candidates = [
        process.env.KHALTI_SECRET_KEY,
        process.env.KHALTI_TEST_SECRET_KEY,
        process.env.KHALTI_SANDBOX_SECRET_KEY,
        process.env.KHALTI_LIVE_SECRET_KEY
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => !isPlaceholderKey(value));

    return Array.from(new Set(candidates));
};

const isPlaceholderKey = (key = '') => key.includes('your_khalti_') || key.includes('your_khalti');
const isInvalidTokenError = (err) => {
    const detail = String((err && err.payload && err.payload.detail) || err.message || '').toLowerCase();
    return err && err.status === 401 && detail.includes('invalid token');
};

const withTimeout = async (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

const isPaymentUrlReachable = async (url) => {
    if (!url) return false;
    try {
        const res = await withTimeout(fetch(url, { method: 'GET', redirect: 'manual' }), 8000);
        return res.status < 500;
    } catch (err) {
        return false;
    }
};

const toKhaltiPaisa = (amount) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        return 0;
    }
    return Math.round(numericAmount * 100);
};

const readJsonResponse = async (response) => {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (err) {
        return {
            raw: text
        };
    }
};

const sendKhaltiRequest = async (url, payload, authHeaderValue) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: authHeaderValue,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        const error = new Error((data && data.detail) || (data && data.message) || 'Khalti request failed.');
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
};

const postKhaltiJson = async (url, payload, secretKey) => {
    if (!secretKey) {
        const error = new Error(
            'Khalti secret key is missing. Set one of KHALTI_SECRET_KEY, KHALTI_TEST_SECRET_KEY, KHALTI_SANDBOX_SECRET_KEY, or KHALTI_LIVE_SECRET_KEY in .env.'
        );
        error.status = 500;
        throw error;
    }
    if (isPlaceholderKey(secretKey)) {
        const error = new Error(
            'Khalti secret key is still placeholder text. Replace KHALTI_SECRET_KEY in .env with your actual key from test-admin.khalti.com.'
        );
        error.status = 500;
        throw error;
    }

    // Khalti docs commonly show `Key <secret>`, but some environments accept only lowercase `key`.
    // Retry both before surfacing failure.
    const authVariants = [`Key ${secretKey}`, `key ${secretKey}`];
    let lastError = null;
    for (const authHeaderValue of authVariants) {
        try {
            return await sendKhaltiRequest(url, payload, authHeaderValue);
        } catch (err) {
            lastError = err;
            const detail = String((err && err.payload && err.payload.detail) || err.message || '').toLowerCase();
            const retryableAuthFailure = err && err.status === 401 && detail.includes('invalid token');
            if (!retryableAuthFailure) {
                throw err;
            }
        }
    }
    throw lastError || new Error('Khalti request failed.');
};

const initiateKhaltiPayment = async (payload) => {
    const keyCandidates = getKhaltiSecretKeyCandidates();
    if (keyCandidates.length === 0) {
        const error = new Error(
            'No valid Khalti secret key found. Set one of KHALTI_SECRET_KEY, KHALTI_TEST_SECRET_KEY, KHALTI_SANDBOX_SECRET_KEY, or KHALTI_LIVE_SECRET_KEY.'
        );
        error.status = 500;
        throw error;
    }
    const attemptUrls = [KHALTI_INITIATE_URL, KHALTI_ALT_INITIATE_URL];
    let lastError;

    for (const secretKey of keyCandidates) {
        for (const url of attemptUrls) {
            try {
                const data = await postKhaltiJson(url, payload, secretKey);
                const paymentUrl = String((data && data.payment_url) || '').trim();
                if (!paymentUrl) {
                    lastError = new Error('Khalti did not return payment_url.');
                    continue;
                }
                const reachable = await isPaymentUrlReachable(paymentUrl);
                if (reachable) {
                    return data;
                }
                lastError = new Error(`Khalti payment URL is currently unreachable: ${paymentUrl}`);
                continue;
            } catch (err) {
                lastError = err;
                if (!isInvalidTokenError(err)) {
                    continue;
                }
            }
        }
    }

    throw lastError || new Error('Unable to initiate Khalti checkout.');
};

const lookupKhaltiPayment = async (payload) => {
    const keyCandidates = getKhaltiSecretKeyCandidates();
    if (keyCandidates.length === 0) {
        const error = new Error(
            'No valid Khalti secret key found. Set one of KHALTI_SECRET_KEY, KHALTI_TEST_SECRET_KEY, KHALTI_SANDBOX_SECRET_KEY, or KHALTI_LIVE_SECRET_KEY.'
        );
        error.status = 500;
        throw error;
    }
    const attemptUrls = [KHALTI_LOOKUP_URL, KHALTI_ALT_LOOKUP_URL];
    let lastError;
    for (const secretKey of keyCandidates) {
        for (const url of attemptUrls) {
            try {
                return await postKhaltiJson(url, payload, secretKey);
            } catch (err) {
                lastError = err;
            }
        }
    }
    throw lastError || new Error('Unable to verify Khalti checkout.');
};

module.exports = {
    KHALTI_ENV,
    KHALTI_API_BASE_URL,
    KHALTI_ALT_API_BASE_URL,
    KHALTI_INITIATE_URL,
    KHALTI_LOOKUP_URL,
    initiateKhaltiPayment,
    lookupKhaltiPayment,
    toKhaltiPaisa
};
