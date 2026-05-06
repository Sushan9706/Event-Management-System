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

        // Allow admins to access /admin, /logout, and /profile routes
        if (
            user.role === 'admin' && 
            !req.originalUrl.startsWith('/admin') && 
            !req.originalUrl.startsWith('/logout') &&
            !req.originalUrl.startsWith('/profile')
        ) {
            return res.redirect('/admin/dashboard');
        }

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
        res.redirect('/user'); // Send regular users back to their dashboard
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
