// const express = require("express");
// const path = require("path");
// const app = express();

// // Set EJS as the view engine
// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));

// // Serve static files
// app.use(express.static(path.join(__dirname, "public")));

// // Route for /event
// app.get("/event", (req, res) => {
//   res.render("event");
// });

// // Handle port conflict gracefully
// const server = app.listen(3000, () => {
//   console.log("Server running on http://localhost:3000");
// });

// server.on("error", (err) => {
//   if (err.code === "EADDRINUSE") {
//     console.log("Port 3000 busy, retrying on 3001...");
//     server.listen(3001);
//   }
// });