const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  category: { type: String, required: true },
  capacity: { type: Number, required: true },
  ratePerDay: { type: Number, required: true },
  image: { type: String, default: "/images/default-venue.png" },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Venue", venueSchema);
