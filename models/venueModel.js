const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['Conference Room', 'Ballroom', 'Outdoor Space', 'Auditorium', 'Exhibition Hall', 'Meeting Room', 'Other']
    },
    capacity: { type: Number, required: true },
    hourlyRate: { type: Number },
    dailyRate: { type: Number },
    imagePath: { type: String, default: '/images/default-venue.png' },
    status: { type: String, enum: ['available', 'maintenance', 'archived'], default: 'available' }
}, { timestamps: true });

// Validation: At least one rate must be provided
venueSchema.pre('validate', function(next) {
    if (!this.hourlyRate && !this.dailyRate) {
        this.invalidate('hourlyRate', 'At least one rate (hourly or daily) must be provided.');
        this.invalidate('dailyRate', 'At least one rate (hourly or daily) must be provided.');
    }
    next();
});

module.exports = mongoose.model('Venue', venueSchema);
