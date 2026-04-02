const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    location: { type: String, required: true },
    description: String,

    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    maxCapacity: Number,
    ticketPrice: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ["upcoming", "ongoing", "completed", "cancelled"],
        default: "upcoming"
    },

    imagePath: String,

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user" // matching the name in models/user.js
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Event", eventSchema);
