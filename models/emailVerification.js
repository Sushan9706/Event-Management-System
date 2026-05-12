const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0 // TTL index: MongoDB will automatically delete documents when current time > expiresAt
    },
    used: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Ensure any existing codes for the same email are invalidated when a new one is created
// We can handle this in the controller, but having the schema ready is good.

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
