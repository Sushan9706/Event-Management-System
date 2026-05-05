const crypto = require('crypto');

const ESEWA_PAYMENT_URL = '/dummy-esewa/start';
const ESEWA_PRODUCT_CODE = 'EPAYTEST';
const ESEWA_SECRET_KEY = '8gBm/:&EnhH.1/q';
const ESEWA_SIGNED_FIELD_NAMES = 'total_amount,transaction_uuid,product_code';

const formatEsewaAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        return '0';
    }
    return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
};

const createHmacSignature = (message) => (
    crypto
        .createHmac('sha256', ESEWA_SECRET_KEY)
        .update(message)
        .digest('base64')
);

const createEsewaSignature = (fields, signedFieldNames = ESEWA_SIGNED_FIELD_NAMES) => {
    const message = signedFieldNames
        .split(',')
        .map((fieldName) => `${fieldName}=${fields[fieldName]}`)
        .join(',');
    return createHmacSignature(message);
};

const safeCompare = (actual, expected) => {
    const actualBuffer = Buffer.from(String(actual || ''));
    const expectedBuffer = Buffer.from(String(expected || ''));
    return actualBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const decodeEsewaData = (encodedData) => {
    const normalizedData = String(encodedData || '').replace(/ /g, '+');
    return JSON.parse(Buffer.from(normalizedData, 'base64').toString('utf8'));
};

const encodeEsewaData = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64');

const buildEsewaSuccessPayload = ({ transactionUuid, totalAmount }) => {
    const payload = {
        transaction_code: `DUMMY-${Date.now()}`,
        status: 'COMPLETE',
        total_amount: formatEsewaAmount(totalAmount),
        transaction_uuid: transactionUuid,
        product_code: ESEWA_PRODUCT_CODE,
        signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code'
    };

    return {
        ...payload,
        signature: createEsewaSignature(payload, payload.signed_field_names)
    };
};

const verifyEsewaResponseSignature = (payload) => {
    if (!payload || !payload.signature || !payload.signed_field_names) {
        return false;
    }
    const expectedSignature = createEsewaSignature(payload, payload.signed_field_names);
    return safeCompare(payload.signature, expectedSignature);
};

const buildEsewaPaymentFields = ({ amount, transactionUuid, successUrl, failureUrl }) => {
    const amountValue = formatEsewaAmount(amount);
    const fields = {
        amount: amountValue,
        tax_amount: '0',
        total_amount: amountValue,
        transaction_uuid: transactionUuid,
        product_code: ESEWA_PRODUCT_CODE,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: ESEWA_SIGNED_FIELD_NAMES
    };

    return {
        ...fields,
        signature: createEsewaSignature(fields)
    };
};

module.exports = {
    ESEWA_PAYMENT_URL,
    ESEWA_PRODUCT_CODE,
    formatEsewaAmount,
    buildEsewaPaymentFields,
    decodeEsewaData,
    encodeEsewaData,
    buildEsewaSuccessPayload,
    verifyEsewaResponseSignature
};
