const Event = require('../models/event');
const Category = require('../models/categoryModel');
const Booking = require('../models/bookingModel');
const User = require('../models/user');
const path = require('path');
const fs = require('fs');

/**
 * Seed Categories if they don't exist
 */
const seedCategories = async () => {
    const count = await Category.countDocuments();
    if (count === 0) {
        const defaultCategories = [
            { name: "Music" },
            { name: "Technology" },
            { name: "Sports" },
            { name: "Arts" },
            { name: "Food and Drink" },
            { name: "Networking" },
            { name: "Education" },
            { name: "Other" }
        ];
        await Category.insertMany(defaultCategories);
    }
};

// ─── MANAGE EVENTS PAGE ──────────────────────────────────────
exports.getManageEvents = async (req, res) => {
    try {
        await seedCategories();

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        let query = {};
        if (search) {
            query.eventName = { $regex: search, $options: 'i' };
        }
        if (status !== 'all') {
            query.status = status;
        }

        const totalItems = await Event.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        const events = await Event.find(query)
            .populate('categoryId')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Stats for cards - based on ALL events not just filtered ones for accurate dashboard
        const totalEventsCount = await Event.countDocuments();
        const activeEventsCount = await Event.countDocuments({ status: { $nin: ['completed', 'cancelled'] } });
        const totalAttendees = await Booking.countDocuments({ status: 'confirmed' });

        // Avg Attendance (Mocked or calculated if possible)
        const allEvents = await Event.find();
        let avgAttendance = 0;
        if (totalEventsCount > 0) {
            const totalCapacity = allEvents.reduce((sum, e) => sum + (e.maxCapacity || 0), 0);
            avgAttendance = totalCapacity > 0 ? Math.round((totalAttendees / totalCapacity) * 100) : 0;
        }

        const stats = {
            totalEvents: totalEventsCount,
            activeEvents: activeEventsCount,
            totalAttendees: totalAttendees,
            avgAttendance: avgAttendance
        };

        // If AJAX request, return JSON
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                events,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems
                }
            });
        }

        res.render('admin/manageEvents', {
            events,
            stats,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems
            }
        });
    } catch (err) {
        console.error('Error loading manage events:', err);
        req.flash('error', 'Failed to load events');
        res.redirect('/');
    }
};

// ─── CREATE EVENT PAGE ───────────────────────────────────────
exports.getCreateEvent = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('admin/createEvent', { categories });
    } catch (err) {
        console.error('Error loading create event page:', err);
        res.redirect('/admin/dashboard');
    }
};

exports.postCreateEvent = async (req, res) => {
    try {
        const { eventName, description, categoryId, startDate, startTime, endDate, endTime, location, maxCapacity, ticketPrice, status } = req.body;
 
        // --- Date Validation: Cannot go past today ---
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
 
        if (start < today) {
            req.flash('error', 'Start date cannot be in the past');
            return res.redirect('/admin/events/create');
        }

        // Check if start time is in the past for today
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const minDateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        if (startDate === minDateStr && startTime < currentTime) {
            req.flash('error', 'Start time cannot be in the past for events starting today');
            return res.redirect('/admin/events/create');
        }
 
        if (end < start) {
            req.flash('error', 'End date cannot be before start date');
            return res.redirect('/admin/events/create');
        }

        if (startDate === endDate && startTime >= endTime) {
            req.flash('error', 'End time must be after start time for same-day events');
            return res.redirect('/admin/events/create');
        }
 
        // Sync category for legacy support if needed
        let category = 'other';
        if (categoryId) {
            const catDoc = await Category.findById(categoryId);
            if (catDoc) category = catDoc.name;
        }
 
        const eventData = {
            eventName,
            description,
            categoryId,
            startDate,
            startTime,
            endDate,
            endTime,
            location,
            maxCapacity: Math.max(0, parseInt(maxCapacity) || 0),
            ticketPrice: Math.max(0, parseFloat(ticketPrice) || 0),
            status: status || 'upcoming',
            createdBy: req.user ? req.user.userId : null
        };

        if (req.file) {
            eventData.imagePath = '/images/events/' + req.file.filename;
        } else {
            // Default image if no image Provided
            eventData.imagePath = 'https://www.cvent.com/sites/default/files/styles/column_content_width/public/image/2023-11/53322146052_90bc13d238_c.jpg.webp?itok=YayCFh_V';
        }

        await Event.create(eventData);

        req.flash('success', 'Event created successfully!');
        res.redirect('/admin/dashboard');
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
            return res.redirect('/admin/dashboard');
        }
        const categories = await Category.find();
        res.render('admin/editEvent', { event, categories });
    } catch (err) {
        console.error('Error loading edit event:', err);
        req.flash('error', 'Failed to load event');
        res.redirect('/admin/dashboard');
    }
};

exports.postEditEvent = async (req, res) => {
    try {
        const { eventName, description, categoryId, startDate, startTime, endDate, endTime, location, maxCapacity, ticketPrice, status } = req.body;
        const event = await Event.findById(req.params.id);
 
        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/admin/dashboard');
        }
 
        // --- Date Validation ---
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
 
        if (start < today) {
            req.flash('error', 'Start date cannot be in the past');
            return res.redirect(`/admin/events/edit/${req.params.id}`);
        }

        // Check if start time is in the past for today
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const minDateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        if (startDate === minDateStr && startTime < currentTime) {
            req.flash('error', 'Start time cannot be in the past for events starting today');
            return res.redirect(`/admin/events/edit/${req.params.id}`);
        }
 
        if (end < start) {
            req.flash('error', 'End date cannot be before start date');
            return res.redirect(`/admin/events/edit/${req.params.id}`);
        }

        if (startDate === endDate && startTime >= endTime) {
            req.flash('error', 'End time must be after start time for same-day events');
            return res.redirect(`/admin/events/edit/${req.params.id}`);
        }
 
        event.eventName = eventName;
        event.description = description;
        event.categoryId = categoryId;
        event.startDate = startDate;
        event.startTime = startTime;
        event.endDate = endDate;
        event.endTime = endTime;
        event.location = location;
        event.maxCapacity = Math.max(0, parseInt(maxCapacity) || 0);
        event.ticketPrice = Math.max(0, parseFloat(ticketPrice) || 0);
        event.status = status || 'upcoming';

        if (req.file) {
            if (event.imagePath && !event.imagePath.startsWith('http')) {
                const oldPath = path.join(__dirname, '..', 'public', event.imagePath);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            event.imagePath = '/images/events/' + req.file.filename;
        } else if (!event.imagePath) {
            // Default image if no image Provided
            event.imagePath = 'https://www.cvent.com/sites/default/files/styles/column_content_width/public/image/2023-11/53322146052_90bc13d238_c.jpg.webp?itok=YayCFh_V';
        }

        await event.save();

        // --- Create Notifications for Confirmed Bookers ---
        try {
            const confirmedBookings = await Booking.find({ eventId: event._id, status: 'confirmed' });
            const userEmails = [...new Set(confirmedBookings.map(b => b.userEmail))];

            if (userEmails.length > 0) {
                const notification = {
                    type: 'event_update',
                    eventId: event._id,
                    eventName: event.eventName,
                    message: `Event details have been updated: ${event.eventName}`,
                    link: `/event/${event._id}`,
                    isRead: false,
                    createdAt: new Date()
                };

                // Add notification to users who don't already have an unread 'event_update' for this event
                // This prevents spamming if the admin edits multiple times rapidly
                await User.updateMany(
                    { 
                        email: { $in: userEmails },
                        notifications: { 
                            $not: { 
                                $elemMatch: { 
                                    eventId: event._id, 
                                    type: 'event_update', 
                                    isRead: false 
                                } 
                            } 
                        } 
                    },
                    { 
                        $push: { 
                            notifications: { 
                                $each: [notification], 
                                $position: 0 
                            } 
                        } 
                    }
                );
            }
        } catch (notifErr) {
            console.error('Error creating notifications:', notifErr);
            // Don't fail the event update if notifications fail
        }

        req.flash('success', 'Event updated successfully!');
        res.redirect('/admin/dashboard');
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
        if (event && event.imagePath) {
            const imgPath = path.join(__dirname, '..', 'public', event.imagePath);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }

        await Event.findByIdAndDelete(req.params.id);
        // Clean up bookings if model exists and has correct field
        if (Booking && Booking.deleteMany) {
            await Booking.deleteMany({ eventId: req.params.id });
        }

        req.flash('success', 'Event deleted successfully');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Error deleting event:', err);
        req.flash('error', 'Failed to delete event');
        res.redirect('/admin/dashboard');
    }
};

// ─── REMOVE EVENT IMAGE ──────────────────────────────────────
exports.removeEventImage = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (event && event.imagePath) {
            const imgPath = path.join(__dirname, '..', 'public', event.imagePath);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

            event.imagePath = null;
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
        const event = await Event.findById(req.params.id).populate('categoryId');
        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/admin/dashboard');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const statusFilter = req.query.status || 'all';
        const search = req.query.search || '';

        // Build query
        const query = { eventId: req.params.id };
        if (statusFilter !== 'all') query.status = statusFilter;
        if (search) {
            query.$or = [
                { userName: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } },
                { referenceNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const totalItems = await Booking.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalBookings = await Booking.countDocuments({ eventId: req.params.id, status: { $ne: 'cancelled' } });
        const capacityPercent = event.maxCapacity > 0 ? Math.round((totalBookings / event.maxCapacity) * 100) : 0;

        // If AJAX request
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                bookings,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems
                }
            });
        }

        res.render('admin/bookingDetails', {
            event,
            bookings,
            totalBookings,
            capacityPercent,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems
            },
            filters: {
                status: statusFilter,
                search
            }
        });
    } catch (err) {
        console.error('Error loading booking details:', err);
        req.flash('error', 'Failed to load booking details');
        res.redirect('/admin/dashboard');
    }
};

// ─── CSV EXPORT ──────────────────────────────────────────────
exports.exportBookingsCsv = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).send('Event not found');

        const bookings = await Booking.find({ eventId: req.params.id }).sort({ createdAt: -1 });

        let csv = 'Name,Email,Reference,Status,Booking Date\n';
        bookings.forEach(b => {
            csv += `"${b.userName}","${b.userEmail}","${b.referenceNumber}","${b.status}","${b.createdAt}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${event.eventName.replace(/[^a-zA-Z0-9]/g, '_')}_attendees.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Error exporting CSV:', err);
        res.status(500).send('Failed to export');
    }
};

// ─── GET NOTIFICATIONS (AJAX) ────────────────────────────────
exports.getNotifications = async (req, res) => {
    try {
        // Fetch last 10 bookings as notifications
        const notifications = await Booking.find()
            .populate('eventId')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};
