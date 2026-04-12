const Event = require('../models/event');

const getAllEvents = async (req, res) => {
    try {
        const events = await Event.find({});
        res.render('index', { title: 'Event Master - All Events', events });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).render('404', { title: '404 - Not Found' });
        res.render('event', { event, user: req.user || null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getAllEvents,
    getEventById
};
