const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userModel = require("../models/user");
const eventModel = require("../models/event");

exports.getRegister = (req, res) => {
    res.render("register");
};

exports.postRegister = async (req, res) => {
    try {
        let { username, email, password, confirmPassword } = req.body;

        const errors = [];

        // 🚫 Reserved email check
        if (email.toLowerCase() === "admin@ems.com") {
            errors.push('This email is reserved for system administration.');
        }

        // 🔐 Password validations
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long.');
        }

        if (!/[A-Za-z]/.test(password)) {
            errors.push('Password must contain at least one letter.');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number.');
        }

        if (!/[^A-Za-z0-9]/.test(password)) {
            errors.push('Password must contain at least one symbol.');
        }

        // 🔁 Confirm password
        if (password !== confirmPassword) {
            errors.push('Passwords do not match.');
        }

        // ❌ If any errors → send all
        if (errors.length > 0) {
            errors.forEach(err => req.flash('error', err));
            return res.redirect('/register');
        }

        // 1. Define admin
        const adminEmail = "admin@ems.com"; 
        let assignedRole = 'user';

        if (email === adminEmail) {
            assignedRole = 'admin';
        }

        // 2. Check existing user
        let existingUser = await userModel.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            req.flash('error', 'Credentials already exists. Please try again!');
            return res.redirect('/register');
        }

        // 3. Hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 4. Create user
        let user = await userModel.create({ 
            username, 
            email, 
            password: hash, 
            role: assignedRole 
        });

        // 5. Token
        let token = jwt.sign(
            { email: email, userId: user._id, role: user.role },
            "shhhhhhhhh"
        );

        res.cookie("token", token);

        // 6. Redirect
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/login');
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Error during registration");
    }
};

exports.getLogin = (req, res) => {
    res.render("login");
};

exports.postLogin = async (req, res) => {
    try {
        const { username: identifier, password } = req.body;
        const user = await userModel.findOne({
            $or: [{ email: identifier }, { username: identifier }]
        });

        if (!user) {
            req.flash('error', 'Invalid Credentials');
            return res.redirect('/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign(
                { email: user.email, userId: user._id, role: user.role }, 
                "shhhhhhhhh"
            );
            res.cookie("token", token);

            // THE REDIRECT LOGIC
            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            }
            return res.redirect('/user'); // Regular user dashboard
        } else {
            req.flash('error', 'Invalid Credentials');
            res.redirect('/login');
        }
    } catch (err) {
        res.redirect('/login');
    }
};

exports.getUserDashboard = async (req, res) => {
    try {
        const now = new Date();

        // 1. Find the user
        // 2. Populate 'bookedEvents' BUT with a match filter for the date
        const user = await userModel.findById(req.user.userId).populate({
            path: 'bookedEvents',
            match: { date: { $gte: now } }, // Only fetch events happening today or later
            options: { sort: { date: 1 } }  // Sort them so the soonest is first
        });

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }

        // Now, user.bookedEvents only contains active, future events.
        res.render('user', { user }); 
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.redirect('/login');
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.userId;

        // $pull removes the specific ID from the bookedEvents array
        await userModel.findByIdAndUpdate(userId, {
            $pull: { bookedEvents: eventId }
        });

        res.json({ success: true, message: "Booking cancelled successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.getGuestDashboard = async (req, res) => {
    try {
        // Fetch ALL events to show by default
        const events = await eventModel.find({});
        res.render("index", { events: events });
    } catch (err) {
        res.status(500).send("Error loading dashboard");
    }
};

exports.searchEvents = async (req, res) => {
    try {
        let { q, date } = req.query;
        let queryObj = {};

        // 1. Text Search (Matches title regardless of case)
        if (q) {
            queryObj.title = { $regex: q, $options: "i" };
        }

        // 2. Date Search
        if (date) {
            queryObj.date = { 
                $gte: new Date(date), 
                $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) 
            };
        }

        // Fetch events from DB
        const events = await eventModel.find(queryObj);

        // Render the page with the found events
        res.render("index", { events: events });
    } catch (err) {
        res.status(500).send("Search failed");
    }
};

// Add this to your userController.js
exports.getProfile = async (req, res) => {
    try {
        // req.user.userId comes from your auth middleware
        const user = await userModel.findById(req.user.userId);
        
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }

        // Render profile.ejs and pass the user object
        res.render('profile', { user });
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).send("Internal Server Error");
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: "New passwords do not match." });
        }

        const user = await userModel.findById(req.user.userId);

        // 1. Verify the OLD password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect." });
        }

        // 2. Hash the NEW password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // 3. Update the database
        user.password = newHash;
        await user.save();

        res.json({ message: "Password updated successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error during password update." });
    }
};

exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // The path we store in the DB (relative to the 'public' folder)
        const imagePath = `/images/uploads/${req.file.filename}`;

        await userModel.findByIdAndUpdate(req.user.userId, {
            profileImage: imagePath
        });

        res.json({ 
            message: "Avatar updated successfully!", 
            imagePath: imagePath 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error saving avatar" });
    }
}; 

exports.updateProfileInfo = async (req, res) => {
    try {
        const { removeProfileImage } = req.body;
        const updateData = {};

        // 1. Handle Image logic
        if (removeProfileImage === 'true') {
            // Set back to your DB default or an empty string
            updateData.profileImage = "https://tinyurl.com/3jjyxzj6"; 
        } else if (req.file) {
            // req.file is populated by upload.single('avatar')
            updateData.profileImage = `/images/uploads/${req.file.filename}`;
        }

        // 2. Update DB
        const updatedUser = await userModel.findByIdAndUpdate(
            req.user.userId, 
            updateData, 
            { new: true }
        );

        res.json({ 
            message: "Profile updated successfully!", 
            user: updatedUser 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating profile." });
    }
};



exports.logout = (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
};