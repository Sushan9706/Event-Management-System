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
    bookedEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "event"
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model("user", userSchema);