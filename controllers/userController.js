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

        // Prevent anyone from registering as an admin email
        if (email.toLowerCase() === "admin@ems.com") {
            req.flash('error', 'This email is reserved for system administration.');
            return res.redirect('/register');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/register');
        }

        // 1. Define who gets to be an admin
        const adminEmail = "admin@ems.com"; 
        let assignedRole = 'user';

        if (email === adminEmail) {
            assignedRole = 'admin';
        }

        // 2. Check if user already exists
        let existingUser = await userModel.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            req.flash('error', 'User already exists. Please try again!');
            return res.redirect('/register');
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 3. Create User with the assignedRole
        let user = await userModel.create({ 
            username, 
            email, 
            password: hash, 
            role: assignedRole 
        });

        // 4. Generate Token
        let token = jwt.sign({ email: email, userId: user._id, role: user.role }, "shhhhhhhhh");
        res.cookie("token", token);

        // 5. Dynamic Redirect based on Role
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
        // We find the user and 'populate' the bookedEvents field
        const user = await userModel.findById(req.user.userId).populate('bookedEvents');
        
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }

        // We pass the user (which now contains bookedEvents) to the EJS
        res.render('user', { user }); 
    } catch (err) {
        console.error(err);
        res.redirect('/login');
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
        const { username, email } = req.body;
        const updateData = { username, email };

        // If a file was uploaded via Multer, add the path to the update object
        if (req.file) {
            updateData.profileImage = `/images/uploads/${req.file.filename}`;
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            req.user.userId, 
            updateData, 
            { new: true } // Returns the updated document
        );

        res.json({ 
            message: "Profile updated!", 
            user: updatedUser 
        });
    } catch (err) {
        console.error(err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Username or Email already taken." });
        }
        res.status(500).json({ message: "Error updating profile." });
    }
};



exports.logout = (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
};