const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema({
    venueName: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String },
    capacity: { type: Number, required: true, default: 0 },
    image: { type: String },
    imagePath: { type: String },
    contactInfo: { type: String },
    pricePerHour: { type: Number, default: 0 },
    status: { type: String, enum: ['available', 'maintenance', 'booked'], default: 'available' }
}, { timestamps: true });

// Pre-save middleware to synchronize imagePath and image
venueSchema.pre('save', async function () {
    if (this.isModified('imagePath')) {
        this.image = this.imagePath;
    } else if (this.isModified('image')) {
        this.imagePath = this.image;
    } else {
        if (this.imagePath && !this.image) this.image = this.imagePath;
        if (this.image && !this.imagePath) this.imagePath = this.image;
    }
});

module.exports = mongoose.model("Venue", venueSchema);
