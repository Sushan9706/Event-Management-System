const jwt = require("jsonwebtoken");

// Check if user is logged in
exports.isLoggedIn = (req, res, next) => {
    if (!req.cookies || !req.cookies.token) {
        return res.redirect("/login");
    }
    try {
        let data = jwt.verify(req.cookies.token, "shhhhhhhhh");
        req.user = data;
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