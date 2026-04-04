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
        const user = await userModel.findById(req.user.userId); // get user info from JWT
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }
        res.render('user', { user }); // render user.ejs
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

exports.logout = (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
};