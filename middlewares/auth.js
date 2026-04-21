// Check if user is logged in
const jwt = require("jsonwebtoken");

exports.isLoggedIn = (req, res, next) => {
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return res.redirect("/login");
    }

    try {
        const user = jwt.verify(token, "shhhhhhhhh");
        req.user = user;
        res.locals.user = user;
        next();
    } catch (err) {
        res.cookie("token", "");
        return res.redirect("/login");
    }
};

// NEW: Check if the logged-in user is an admin
exports.isAdmin = (req, res, next) => {
    // req.user was set by the isLoggedIn middleware right before this
    if (req.user && req.user.role === 'admin') {
        next(); // They are admin, proceed to the route
    } else {
        req.flash('error', 'Access Denied: Admins Only');
        res.redirect('/'); // Send regular users back to the home page
    }
};

// Ensure the logged-in user is a regular user
exports.isUser = (req, res, next) => {
    if (req.user && req.user.role === 'user') {
        next();
    } else if (req.user && req.user.role === 'admin') {
        // Redirect admins away from user-specific pages
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/login');
    }
};

exports.redirectIfLoggedIn = (req, res, next) => {
    const token = req.cookies && req.cookies.token;

    if (token) {
        try {
            const user = jwt.verify(token, "shhhhhhhhh");
            if (user.role === 'admin') {
                return res.redirect("/admin/dashboard");
            }
            return res.redirect("/user");
        } catch (err) {
            return next();
        }
    }

    next();
};
