const Venue = require('../models/venueModel');
const userModel = require('../models/user');

exports.getVenues = async (req, res) => {
    try {
        const venues = await Venue.find({ status: { $ne: 'maintenance' } }).lean();
        
        let fullUser = null;
        if (req.user && req.user.userId) {
            fullUser = await userModel.findById(req.user.userId);
        }

        res.render('venues', {
            venues: venues,
            user: fullUser,
            title: 'EMS - Discover Venues'
        });
    } catch (err) {
        console.error("Error loading venues:", err);
        res.status(500).send("Error loading venues");
    }
};

exports.getVenueById = async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id).lean();
        if (!venue) return res.status(404).render('404', { title: '404 - Not Found' });

        res.render('venueDetail', { venue, user: req.user || null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.searchVenues = async (req, res) => {
    try {
        let { q, location, capacity } = req.query;
        let queryObj = { status: { $ne: 'maintenance' } };

        if (q) {
            queryObj.venueName = { $regex: q, $options: "i" };
        }

        if (location) {
            queryObj.location = { $regex: location, $options: "i" };
        }

        if (capacity) {
            queryObj.capacity = { $gte: parseInt(capacity) };
        }

        const venues = await Venue.find(queryObj).lean();
        res.render("venues", { venues: venues, user: req.user || null });
    } catch (err) {
        console.error("Search failed:", err);
        res.status(500).send("Search failed");
    }
};
