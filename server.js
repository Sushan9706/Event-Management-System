require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/mongoDb');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// Error handling for port in use
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use.`);
        console.error(`💡 Suggestion: Kill the process using port ${PORT} or use a different port.`);
        console.error(`   Run: 'lsof -i :${PORT}' to find the process ID (PID) and then 'kill -9 <PID>'.`);
        console.error(`   Alternatively, run: 'PORT=3001 npm run dev'`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
    }
});
