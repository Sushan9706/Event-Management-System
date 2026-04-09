const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userModel = require("../models/user");
const eventModel = require("../models/event");
const categoryModel = require("../models/categoryModel");

exports.getRegister = (req, res) => {
    res.render("register");
};

exports.postRegister = async (req, res) => {
    try {
        let { username, email, password, confirmPassword } = req.body;
        const errors = [];

        // 1. Unified Password Validation (Regex)
        // This regex ensures: 8+ chars, at least 1 letter, 1 number, 1 symbol, and NO spaces
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])(?!.*\s).{8,}$/;

        if (!passwordRegex.test(password)) {
            errors.push('Password must be at least 8 characters long and include letters, numbers, and symbols (no spaces).');
        }

        // 2. Check if passwords match
        if (password !== confirmPassword) {
            errors.push('Passwords do not match.');
        }

        // 3. Reserved admin email check
        if (email.toLowerCase() === "admin@ems.com") {
            errors.push('This email is reserved for system administration.');
        }

        // If any of the above failed, stop and render
        if (errors.length > 0) {
            return res.render('register', { 
                error: errors,
                formData: { username, email }
            });
        }

        // 4. Check for existing email 
        let existingUser = await userModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.render('register', { 
                error: ['An account with this email already exists.'],
                formData: { username, email }
            });
        }

        // 5. Proceed with registration
        const assignedRole = (email.toLowerCase() === "admin@ems.com") ? 'admin' : 'user';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        let user = await userModel.create({ 
            username, 
            email, 
            password: hash, 
            role: assignedRole 
        });

        let token = jwt.sign(
            { email: user.email, userId: user._id, role: user.role },
            "shhhhhhhhh"
        );
        res.cookie("token", token);

        req.flash('success', 'Registration successful!');
        res.redirect('/login');

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).send("An unexpected error occurred. Please try again later.");
    }
};

exports.getLogin = (req, res) => {
    res.render("login");
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.render('login', { 
                error: 'Invalid Credentials',
                formData: { email }
            });
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
            return res.render('login', { 
                error: 'Invalid Credentials',
                formData: { email }
            });
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

        // 1. Get user to get email (for finding the specific booking)
        const user = await userModel.findById(userId);

        // 2. Remove from user's bookedEvents array
        user.bookedEvents = user.bookedEvents.filter(id => id.toString() !== eventId);
        await user.save();

        // 3. Remove from Booking collection as well (or update status to cancelled)
        const bookingModel = require("../models/bookingModel");
        await bookingModel.deleteMany({ eventId, userEmail: user.email });

        res.json({ success: true, message: "Booking cancelled successfully" });
    } catch (err) {
        console.error("Cancel Booking Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.getGuestDashboard = async (req, res) => {
    try {
        // Fetch ALL events to show by default and populate categoryId
        const events = await eventModel.find({}).populate('categoryId');
        res.render("index", { events: events, user: null });
    } catch (err) {
        res.status(500).send("Error loading dashboard");
    }
};

exports.getCatalog = async (req, res) => {
    try {
        const events = await eventModel.find({}).populate('categoryId');
        res.render("catalog", { 
            events: events, 
            user: req.user 
        });
    } catch (err) {
        console.error("Error loading catalog:", err);
        res.status(500).send("Error loading catalog");
    }
};

exports.searchEvents = async (req, res) => {
    try {
        let { q, date, category } = req.query;
        let queryObj = {};

        // 1. Text Search (Matches eventName regardless of case)
        if (q) {
            queryObj.eventName = { $regex: q, $options: "i" };
        }

        // 2. Date Search
        if (date) {
            const searchDate = new Date(date);
            const nextDay = new Date(date);
            nextDay.setDate(searchDate.getDate() + 1);
            
            queryObj.date = { 
                $gte: searchDate, 
                $lt: nextDay 
            };
        }

        // 3. Category Filter
        if (category && category !== "All") {
            // Find the category ID first
            const catDoc = await categoryModel.findOne({ name: category });
            if (catDoc) {
                queryObj.categoryId = catDoc._id;
            }
        }

        // Fetch events from DB and populate categoryId
        const events = await eventModel.find(queryObj).populate('categoryId');

        // Render the page with the found events
        res.render("index", { events: events });
    } catch (err) {
        console.error("Search failed:", err);
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