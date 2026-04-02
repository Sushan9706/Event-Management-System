const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    event_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    user_name: {
        type: String,
        required: true,
        trim: true
    },
    user_email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    reference_number: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['confirmed', 'pending', 'cancelled'],
        default: 'confirmed'
    },
    booking_date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
