const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    // Support both sets of field names to ensure compatibility between branches
    eventName: { type: String, required: true },
    title: { type: String }, // support legacy 'title'
    name: { type: String }, // support seed data / legacy 'name'

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

    maxCapacity: { type: Number, required: true, default: 0 },
    ticketPrice: { type: Number, default: 0 },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }
}, { timestamps: true });

// Pre-save middleware to synchronize title with eventName if one is missing
eventSchema.pre('save', async function () {
    // Sync eventName, title, and name
    if (this.isModified('eventName')) {
        this.title = this.eventName;
        this.name = this.eventName;
    } else if (this.isModified('title')) {
        this.eventName = this.title;
        this.name = this.title;
    } else if (this.isModified('name')) {
        this.eventName = this.name;
        this.title = this.name;
    } else {
        // Fallback for initial creation if only one is provided
        if (this.eventName && !this.title) this.title = this.eventName;
        if (this.title && !this.eventName) this.eventName = this.title;
        if (this.name && !this.eventName) this.eventName = this.name;
        if (this.eventName && !this.name) this.name = this.eventName;
        if (this.title && !this.name) this.name = this.title;
    }

    // Sync imagePath and image
    if (this.isModified('imagePath')) {
        this.image = this.imagePath;
    } else if (this.isModified('image')) {
        this.imagePath = this.image;
    } else {
        // Fallback for initial creation if only one is provided
        if (this.imagePath && !this.image) this.image = this.imagePath;
        if (this.image && !this.imagePath) this.imagePath = this.image;
    }
});



module.exports = mongoose.model("Event", eventSchema);
