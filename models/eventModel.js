const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    time: { type: String },
    location: { type: String, trim: true },
    category: { type: String, trim: true },
    ticketPrice: { type: Number, default: 0 },
    maxCapacity: { type: Number, default: 100 },
    currentBookings: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'draft', 'sold_out'], default: 'active' },
    image: { type: String, default: '' },
    tier: { type: String, default: 'Standard' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
