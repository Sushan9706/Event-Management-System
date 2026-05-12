const mongoose = require('mongoose');
const Venue = require('../models/venueModel');

async function updateVenuePaths() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/eventManagement');
    console.log('Connected to MongoDB');

    const result = await Venue.updateMany(
      { image: '/images/default-venue.png' },
      { $set: { image: '/images/venues/default-venue.png' } }
    );

    console.log(`Updated ${result.modifiedCount} venues.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateVenuePaths();
