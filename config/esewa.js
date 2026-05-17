const crypto = require('crypto');

const ESEWA_ENV = String(process.env.ESEWA_ENV || 'sandbox').trim().toLowerCase();
const ESEWA_PRODUCT_CODE = String(process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST').trim();
const ESEWA_SECRET_KEY = String(process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q').trim();
const ESEWA_FORM_URL = (ESEWA_ENV === 'live'
    ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
    : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
).replace(/\/+$/, '');
const ESEWA_STATUS_URL = (ESEWA_ENV === 'live'
    ? 'https://epay.esewa.com.np/api/epay/transaction/status/'
    : 'https://rc.esewa.com.np/api/epay/transaction/status/'
).replace(/\/+$/, '');

const toEsewaAmount = (amount) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) return 0;
    return Number(numericAmount.toFixed(2));
};

const createEsewaSignature = ({ totalAmount, transactionUuid, productCode = ESEWA_PRODUCT_CODE }) => {
    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    return crypto.createHmac('sha256', ESEWA_SECRET_KEY).update(message).digest('base64');
};

const buildEsewaPaymentPayload = ({
    amount,
    transactionUuid,
    successUrl,
    failureUrl,
    productCode = ESEWA_PRODUCT_CODE
}) => {
    const totalAmount = toEsewaAmount(amount);
    const signature = createEsewaSignature({ totalAmount, transactionUuid, productCode });

    return {
        amount: totalAmount,
        tax_amount: 0,
        total_amount: totalAmount,
        transaction_uuid: transactionUuid,
        product_code: productCode,
        product_service_charge: 0,
        product_delivery_charge: 0,
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature
    };
};

const lookupEsewaPayment = async ({ transactionUuid, totalAmount, productCode = ESEWA_PRODUCT_CODE }) => {
    const url = new URL(ESEWA_STATUS_URL);
    url.searchParams.set('product_code', productCode);
    url.searchParams.set('total_amount', String(toEsewaAmount(totalAmount)));
    url.searchParams.set('transaction_uuid', String(transactionUuid));

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    });

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (err) {
        data = { raw: text };
    }

    if (!response.ok) {
        const error = new Error((data && data.message) || 'Unable to verify eSewa payment.');
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
};

module.exports = {
    ESEWA_ENV,
    ESEWA_PRODUCT_CODE,
    ESEWA_FORM_URL,
    buildEsewaPaymentPayload,
    lookupEsewaPayment,
    toEsewaAmount
};
