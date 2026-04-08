const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
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
    // ADD THIS FIELD:
    profileImage: {
        type: String,
        default: "https://tinyurl.com/3jjyxzj6" // You can set a default placeholder URL here if you like
    }, 
    bookedEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "event"
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model("user", userSchema);