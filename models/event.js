const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    // Support both sets of field names to ensure compatibility between branches
    eventName: { type: String, required: true },
    title: { type: String }, // support legacy 'title'

    date: { type: Date, required: true },
    time: { type: String },
    location: { type: String, required: true },
    description: { type: String },

    // Admin uses categoryId (ObjectId), User uses category (String enum)
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    category: { type: String },

    // Support both image and imagePath
    image: { type: String },
    imagePath: { type: String },

    maxCapacity: { type: Number, default: 0 },
    ticketPrice: { type: Number, default: 0 },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }
}, { timestamps: true });

// Pre-save middleware to synchronize title with eventName if one is missing
eventSchema.pre('save', function (next) {
    if (this.eventName && !this.title) this.title = this.eventName;
    if (this.title && !this.eventName) this.eventName = this.title;
    if (this.imagePath && !this.image) this.image = this.imagePath;
    if (this.image && !this.imagePath) this.imagePath = this.image;
    next();
});

module.exports = mongoose.model("event", eventSchema);