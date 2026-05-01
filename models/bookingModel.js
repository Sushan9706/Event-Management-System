const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        userName: {
            type: String,
            required: true,
            trim: true
        },
        userEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        attendeeEmail: {
            type: String,
            trim: true,
            lowercase: true
        },
        attendeeNames: {
            type: [String],
            default: []
        },
        ticketCount: {
            type: Number,
            default: 1
        },
        unitPrice: {
            type: Number,
            default: 0
        },
        totalAmount: {
            type: Number,
            default: 0
        },
        ticketCodes: {
            type: [String],
            default: []
        },
        referenceNumber: {
            type: String,
            required: true,
            unique: true
        },
        bookingRef: {
            type: String
        },
        status: {
            type: String,
            enum: ['confirmed', 'pending', 'cancelled', 'expired'],
            default: 'confirmed'
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Booking', bookingSchema);
