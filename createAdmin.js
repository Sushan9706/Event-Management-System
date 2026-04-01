// this is a one time script run to create an admin in the mongodb
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const userModel = require('./models/user'); // adjust path if needed

mongoose.connect('mongodb://127.0.0.1:27017/eventManagement');

async function createAdmin() {
    const email = "admin@ems.com";
    const password = "EMS_ADMIN_2026";

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await userModel.create({
        username: "admin",
        email: email,
        password: hash,
        role: "admin"
    });

    console.log("✅ Admin created successfully");
    mongoose.connection.close();
}

createAdmin();