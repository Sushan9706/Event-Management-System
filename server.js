require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/mongoDb");

const PORT = Number(process.env.PORT) || 3000;

let server = null;

const start = async () => {
    try {
        await connectDB();
    } catch (err) {
        // connectDB already logs; this keeps stack visibility if something unexpected bubbles up.
        console.error("❌ Startup failed:", err && err.stack ? err.stack : err);
        process.exit(1);
    }

    server = app.listen(PORT, () => {
        console.log(`✅ Server is running on http://localhost:${PORT}`);
    });

    server.on("error", (err) => {
        if (err && err.code === "EADDRINUSE") {
            console.error(`❌ Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
            process.exit(1);
        }
        console.error("❌ Server error:", err && err.stack ? err.stack : err);
        process.exit(1);
    });
};

const shutdown = async (signal) => {
    // Avoid double-shutdowns on multiple signals.
    if (shutdown.called) return;
    shutdown.called = true;

    try {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    } catch (err) {
        // ignore
    }

    try {
        if (mongoose.connection && mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    } catch (err) {
        // ignore
    }

    process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
