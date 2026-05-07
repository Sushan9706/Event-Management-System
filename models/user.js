const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
        // unique username
    },
    email: {
        type: String,
        required: true,
        unique: true, // Only email is unique
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    profileImage: {
        type: String,
        default: "https://tinyurl.com/3jjyxzj6"
    }, 
    notifications: [{
        type: {
            type: String,
            enum: ["booking_confirmed", "booking_cancelled", "event_update"],
            required: true
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event"
        },
        eventName: {
            type: String,
            trim: true
        },
        message: {
            type: String,
            trim: true
        },
        link: {
            type: String
        },
        isRead: {
            type: Boolean,
            default: false
        },
        ticketCount: {
            type: Number,
            default: 1,
            min: 1
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    bookedEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event"
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model("user", userSchema);
