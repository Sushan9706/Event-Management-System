require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/mongoDb');

// Connect to MongoDB
connectDB();

// --- 1. Find an available port automatically ---
const startServer = (port) => {
    const server = app.listen(port)
        .on('listening', () => {
            console.log(`✅ Server is running on http://localhost:${port}`);
        })
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  Port ${port} is busy (likely another terminal is running the app).`);
                console.log(`👉 Trying port ${port + 1} instead...`);
                startServer(port + 1);
            } else {
                console.error('❌ Server Error:', err);
                process.exit(1);
            }
        });
};

// --- 2. Start the process ---
const PORT = process.env.PORT || 3000;
startServer(PORT);

// --- 3. Catch silent crashes ---
// If the app crashes for some other reason, this will tell us WHY.
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});
