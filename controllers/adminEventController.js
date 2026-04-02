const Event = require('../models/eventModel');
const Booking = require('../models/bookingModel');
const path = require('path');
const fs = require('fs');

// ─── MANAGE EVENTS PAGE ──────────────────────────────────────
exports.getManageEvents = async (req, res) => {
    try {
        const events = await Event.find().sort({ createdAt: -1 });

        // Calculate stats
        const totalEvents = events.length;
        const activeEvents = events.filter(e => e.status === 'active').length;

        // Get total attendees across all events
        const totalAttendees = await Booking.countDocuments({ status: { $ne: 'cancelled' } });

        // Calculate average attendance percentage
        let avgAttendance = 0;
        if (totalEvents > 0) {
            const totalCapacity = events.reduce((sum, e) => sum + (e.max_capacity || 0), 0);
            avgAttendance = totalCapacity > 0 ? Math.round((totalAttendees / totalCapacity) * 100) : 0;
        }

        const stats = { totalEvents, activeEvents, totalAttendees, avgAttendance };

        res.render('admin/manageEvents', { events, stats });
    } catch (err) {
        console.error('Error loading manage events:', err);
        req.flash('error', 'Failed to load events');
        res.redirect('/');
    }
};

// ─── CREATE EVENT PAGE ───────────────────────────────────────
exports.getCreateEvent = (req, res) => {
    res.render('admin/createEvent');
};

exports.postCreateEvent = async (req, res) => {
    try {
        const { name, description, category, date, time, location, city, max_capacity, ticket_price, status } = req.body;

        const eventData = {
            name,
            description,
            category,
            date,
            time,
            location,
            city,
            max_capacity: parseInt(max_capacity) || 100,
            ticket_price: parseFloat(ticket_price) || 0,
            status: status || 'draft'
        };

        // Handle image upload
        if (req.file) {
            eventData.banner_image = '/images/events/' + req.file.filename;
        }

        await Event.create(eventData);

        req.flash('success', 'Event created successfully!');
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Error creating event:', err);
        req.flash('error', 'Failed to create event');
        res.redirect('/admin/events/create');
    }
};

// ─── EDIT EVENT PAGE ─────────────────────────────────────────
exports.getEditEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/admin/events');
        }
        res.render('admin/editEvent', { event });
    } catch (err) {
        console.error('Error loading edit event:', err);
        req.flash('error', 'Failed to load event');
        res.redirect('/admin/events');
    }
};

exports.postEditEvent = async (req, res) => {
    try {
        const { name, description, category, date, time, location, city, max_capacity, ticket_price, status } = req.body;

        const updateData = {
            name,
            description,
            category,
            date,
            time,
            location,
            city,
            max_capacity: parseInt(max_capacity) || 100,
            ticket_price: parseFloat(ticket_price) || 0,
            status: status || 'draft'
        };

        // Handle new image upload
        if (req.file) {
            // Delete old image if exists
            const oldEvent = await Event.findById(req.params.id);
            if (oldEvent && oldEvent.banner_image) {
                const oldPath = path.join(__dirname, '..', 'public', oldEvent.banner_image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updateData.banner_image = '/images/events/' + req.file.filename;
        }

        await Event.findByIdAndUpdate(req.params.id, updateData, { new: true });

        req.flash('success', 'Event updated successfully!');
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Error updating event:', err);
        req.flash('error', 'Failed to update event');
        res.redirect(`/admin/events/edit/${req.params.id}`);
    }
};

// ─── DELETE EVENT ────────────────────────────────────────────
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        // Delete banner image from disk
        if (event && event.banner_image) {
            const imgPath = path.join(__dirname, '..', 'public', event.banner_image);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }

        await Event.findByIdAndDelete(req.params.id);
        await Booking.deleteMany({ event_id: req.params.id });

        req.flash('success', 'Event deleted successfully');
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Error deleting event:', err);
        req.flash('error', 'Failed to delete event');
        res.redirect('/admin/events');
    }
};

// ─── REMOVE EVENT IMAGE ──────────────────────────────────────
exports.removeEventImage = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (event && event.banner_image) {
            const imgPath = path.join(__dirname, '..', 'public', event.banner_image);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

            event.banner_image = null;
            await event.save();
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error removing image:', err);
        res.status(500).json({ success: false, error: 'Failed to remove image' });
    }
};

// ─── BOOKING DETAILS PAGE ───────────────────────────────────
exports.getBookingDetails = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/admin/events');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const statusFilter = req.query.status || 'all';
        const search = req.query.search || '';

        // Build query
        const query = { event_id: req.params.id };
        if (statusFilter !== 'all') query.status = statusFilter;
        if (search) {
            query.$or = [
                { user_name: { $regex: search, $options: 'i' } },
                { user_email: { $regex: search, $options: 'i' } },
                { reference_number: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await Booking.countDocuments(query);
        const bookings = await Booking.find(query)
            .sort({ booking_date: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalBookings = await Booking.countDocuments({ event_id: req.params.id, status: { $ne: 'cancelled' } });
        const capacityPercent = event.max_capacity > 0 ? Math.round((totalBookings / event.max_capacity) * 100) : 0;

        res.render('admin/bookingDetails', {
            event,
            bookings,
            totalBookings,
            capacityPercent,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            },
            filters: {
                status: statusFilter,
                search
            }
        });
    } catch (err) {
        console.error('Error loading booking details:', err);
        req.flash('error', 'Failed to load booking details');
        res.redirect('/admin/events');
    }
};

// ─── CSV EXPORT ──────────────────────────────────────────────
exports.exportBookingsCsv = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).send('Event not found');

        const bookings = await Booking.find({ event_id: req.params.id }).sort({ booking_date: -1 });

        let csv = 'Name,Email,Reference,Status,Booking Date\n';
        bookings.forEach(b => {
            csv += `"${b.user_name}","${b.user_email}","${b.reference_number}","${b.status}","${b.booking_date}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_attendees.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Error exporting CSV:', err);
        res.status(500).send('Failed to export');
    }
};
