const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/eventManagement")
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    category: { type: String, enum: ['FESTIVAL', 'TECH', 'ARTS', 'GALA', 'WORKSHOP', 'SPORTS'] },
    image: { type: String }, // URL to image
    description: { type: String }
});

module.exports = mongoose.model("event", eventSchema);