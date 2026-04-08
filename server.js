require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/mongoDb');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
