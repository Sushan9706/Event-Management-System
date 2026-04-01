const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    bookingRef: { type: String, unique: true },
    status: { type: String, enum: ['confirmed', 'pending', 'cancelled'], default: 'confirmed' },
    amount: { type: Number, default: 0 }
}, { timestamps: true });

// Auto-generate booking reference before saving
bookingSchema.pre('save', function() {
    if (!this.bookingRef) {
        const year = new Date().getFullYear();
        const random = Math.floor(10000 + Math.random() * 90000);
        this.bookingRef = `EMS-${year}-${random}`;
    }
});

module.exports = mongoose.model('Booking', bookingSchema);
