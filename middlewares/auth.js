// Check if user is logged in
const jwt = require("jsonwebtoken");
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ems_token";

const isApiRequest = (req) => {
    const accepts = String(req.headers.accept || "").toLowerCase();
    const xrw = String(req.headers["x-requested-with"] || "").toLowerCase();
    return req.originalUrl.startsWith("/api/") || accepts.includes("application/json") || xrw === "xmlhttprequest";
};

exports.isLoggedIn = (req, res, next) => {
    if (req.user && req.user.userId) {
        return next();
    }

    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
    const token = bearerToken || (req.cookies && (req.cookies[AUTH_COOKIE_NAME] || req.cookies.token));

    if (!token) {
        if (isApiRequest(req)) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please login again." });
        }
        return res.redirect("/login");
    }

    try {
        const user = jwt.verify(token, "shhhhhhhhh");
        req.user = user;
        res.locals.user = user;

        // Allow admins to access /admin, /logout, and /profile routes
        if (
            user.role === 'admin' && 
            !req.originalUrl.startsWith('/api/') &&
            !req.originalUrl.startsWith('/admin') && 
            !req.originalUrl.startsWith('/logout') &&
            !req.originalUrl.startsWith('/profile')
        ) {
            return res.redirect('/admin/dashboard');
        }

        next();
    } catch (err) {
        res.clearCookie(AUTH_COOKIE_NAME);
        res.clearCookie("token");
        if (isApiRequest(req)) {
            return res.status(401).json({ success: false, message: "Session expired. Please login again." });
        }
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
    const token = req.cookies && (req.cookies[AUTH_COOKIE_NAME] || req.cookies.token);

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
