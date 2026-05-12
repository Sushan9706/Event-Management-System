const Venue = require('../models/venueModel');

const getAllVenues = async (req, res) => {
    try {
        // Fetch only active venues and sort alphabetically by name
        const venues = await Venue.find({ isActive: true }).sort({ name: 1 });
        
        res.render('venues', { 
            title: 'EMS - Venues', 
            venues
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getVenueById = async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id);
        if (!venue) {
            return res.status(404).render('404', { title: '404 - Venue Not Found' });
        }
        // In a real app, you might have a specific venue detail page
        // For now, let's just render the same page or a detail page if needed
        res.render('venueDetail', { venue, user: req.user || null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getAllVenues,
    getVenueById
};
