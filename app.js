const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// View engine
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.render("index"); // homepage
});

app.get("/guest", (req, res) => {
  res.render("guest"); // guest page
});

app.get("/user", (req, res) => {
  res.render("user"); // user dashboard
});

app.get("/event", (req, res) => {
  res.render("event");
});

app.get("/catalog", (req, res) => {
  res.render("catalog");
});
app.get("/bookings", (req, res) => {
  res.render("bookings");
});

app.get("/profile", (req, res) => {
  res.render("profile");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/eventcreat", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
