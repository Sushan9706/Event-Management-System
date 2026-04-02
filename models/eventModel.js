const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        default: 'General'
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    location: {
        type: String,
        default: ''
    },
    city: {
        type: String,
        default: ''
    },
    max_capacity: {
        type: Number,
        default: 100
    },
    ticket_price: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'draft', 'cancelled', 'completed'],
        default: 'draft'
    },
    banner_image: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Event', eventSchema);
