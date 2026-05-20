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
        default: ""
    }, 
    notifications: [{
        type: {
            type: String,
            enum: ["booking_confirmed", "booking_cancelled", "venue_booking_confirmed", "venue_booking_cancelled"],
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
        ticketCount: {
            type: Number,
            default: 1,
            min: 1
        },
        read: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        isRead: {
            type: Boolean,
            default: false
        }
    }],
    bookedEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event"
    }],
    adminLastReadNotifications: {
        type: Date,
        default: () => new Date(0)
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("user", userSchema);
