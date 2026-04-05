const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index"); 
});

app.get("/guest", (req, res) => {
  res.render("guest"); 
});

app.get("/user", (req, res) => {
  res.render("user"); 
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
app.get("/profile", (req, res) => {
  res.render("profile");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/eventcreat", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
