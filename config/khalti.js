const KHALTI_API_BASE_URL = 'https://dev.khalti.com/api/v2';
const KHALTI_INITIATE_URL = `${KHALTI_API_BASE_URL}/epayment/initiate/`;
const KHALTI_LOOKUP_URL = `${KHALTI_API_BASE_URL}/epayment/lookup/`;

const getKhaltiSecretKey = () => String(process.env.KHALTI_SECRET_KEY || '').trim();

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

const postKhaltiJson = async (url, payload) => {
    const secretKey = getKhaltiSecretKey();
    if (!secretKey) {
        const error = new Error('Khalti secret key is missing. Set KHALTI_SECRET_KEY in .env.');
        error.status = 500;
        throw error;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `key ${secretKey}`,
            'Content-Type': 'application/json'
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

const initiateKhaltiPayment = (payload) => postKhaltiJson(KHALTI_INITIATE_URL, payload);
const lookupKhaltiPayment = (payload) => postKhaltiJson(KHALTI_LOOKUP_URL, payload);

module.exports = {
    KHALTI_API_BASE_URL,
    KHALTI_INITIATE_URL,
    KHALTI_LOOKUP_URL,
    initiateKhaltiPayment,
    lookupKhaltiPayment,
    toKhaltiPaisa
};
