const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    location: { type: String, required: true },
    category: { type: String, required: true },
    capacity: { type: Number, required: true },
    rate: { type: Number, required: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Venue", venueSchema);
