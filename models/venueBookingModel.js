const mongoose = require('mongoose');

const venueBookingSchema = new mongoose.Schema(
    {
        venueId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Venue',
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        },
        phoneNumber: {
            type: String,
            trim: true,
            default: ''
        },
        totalAmount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['confirmed', 'pending', 'cancelled', 'expired'],
            default: 'confirmed'
        },
        paymentStatus: {
            type: String,
            enum: ['paid', 'unpaid'],
            default: 'unpaid'
        },
        referenceNumber: {
            type: String,
            required: true,
            unique: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('VenueBooking', venueBookingSchema);
