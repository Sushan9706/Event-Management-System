const Event = require('../models/event');

// Placeholder event controller
const getAllEvents = (req, res) => {
    // Logic to fetch events from model
    res.render('index', { title: 'Event Master - All Events' });
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).render("404");
    }

    res.render("event", { event });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

module.exports = {
    getAllEvents,
    getEventById
};
