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
        required: true,
        minlength: 8 
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // Only allows these two values
        default: 'user'          // role defaults to user 
    }
}, {
    timestamps: true // handles the created at and updated at automatically
});

module.exports = mongoose.model("user", userSchema);