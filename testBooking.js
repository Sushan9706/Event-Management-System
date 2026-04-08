const userModel = require("./models/user");
const eventModel = require("./models/event");
const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/eventManagement");

async function manualBook() {
    const user = await userModel.findOne({ email: "your-email@example.com" });
    const event = await eventModel.findOne({}); // Grabs the first event it finds

    if(user && event) {
        user.bookedEvents.push(event._id);
        await user.save();
        console.log("Successfully added booking to user!");
    }
    process.exit();
}
manualBook();