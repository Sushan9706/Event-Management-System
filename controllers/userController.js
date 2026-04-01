const userModel = require("../models/user");

exports.getHome = async (req, res) => {
    try {
        const userId = req.user && req.user.userId;
        const user = userId ? await userModel.findById(userId) : null;
        return res.render("index", { title: "Event Master - Home", user });
    } catch (err) {
        return res.render("index", { title: "Event Master - Home", user: null });
    }
};

exports.logout = (req, res) => {
    res.cookie("token", "");
    res.redirect("/");
};
