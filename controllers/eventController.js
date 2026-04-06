const Event = require('../models/eventModel');

const getAllEvents = async (req, res) => {
    try {
        const events = await Event.find({ status: 'active' });
        res.render('index', { title: 'Event Master - All Events', events });
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).render('404', { title: '404 - Not Found' });
        res.render('eventDetail', { event, user: req.user || null });
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getAllEvents,
    getEventById
};
