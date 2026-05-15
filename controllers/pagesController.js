const User = require("../models/user");

exports.getTerms = (req, res) => {
  res.render("terms", { title: "Terms of Service", activePage: "terms" });
};

exports.getPrivacy = (req, res) => {
  res.render("privacy", { title: "Privacy Policy", activePage: "privacy" });
};

exports.getContact = (req, res) => {
  res.render("contact", { title: "Contact Us", activePage: "contact" });
};

exports.postContact = async (req, res) => {
  try {
    const { fullName, email, subject, message } = req.body;
    // In a real app, you would send an email or save to DB
    console.log(`Contact form submission: from ${fullName} (${email}), subject: ${subject}, message: ${message}`);
    
    req.flash("success", "Thank you for reaching out! We will get back to you within 2 business days.");
    res.redirect("/contact");
  } catch (err) {
    req.flash("error", "Something went wrong. Please try again later.");
    res.redirect("/contact");
  }
};
