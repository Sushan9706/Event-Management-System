const Event = require('../models/event');
const Category = require('../models/categoryModel');
const Booking = require('../models/bookingModel');
const VenueBooking = require('../models/venueBookingModel');
const User = require('../models/user');
const Contact = require('../models/contactModel');
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
        const { syncDatabase } = require("../utils/bookingStatus");
        await syncDatabase();

        await seedCategories();

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 3); // 3 days ago

        let query = {};
        if (search) {
            query.eventName = { $regex: search, $options: 'i' };
        }
        if (status === 'all') {
            // Keep the dashboard clean: hide completed/cancelled/expired events older than 3 days
            query.$or = [
                { status: { $in: ['upcoming', 'ongoing'] } },
                { 
                    status: { $in: ['completed', 'cancelled', 'expired'] }, 
                    $or: [
                        { endDate: { $gte: cutoff } },
                        { updatedAt: { $gte: cutoff } }
                    ]
                }
            ];
        } else {
            query.status = status;
            if (['completed', 'cancelled', 'expired'].includes(status)) {
                query.$or = [
                    { endDate: { $gte: cutoff } },
                    { updatedAt: { $gte: cutoff } }
                ];
            }
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
        
        const confirmedBookingsForStats = await Booking.find({ status: 'confirmed' });
        const totalAttendees = confirmedBookingsForStats.reduce((sum, b) => sum + (b.ticketCount || 0), 0);

        // Registered Users count (excluding admin users)
        const registeredUsersCount = await User.countDocuments({ role: 'user' });

        const stats = {
            totalEvents: totalEventsCount,
            activeEvents: activeEventsCount,
            totalAttendees: totalAttendees,
            registeredUsers: registeredUsersCount
        };

        // If AJAX request, return JSON
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
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
 
        // --- Ticket Price and Capacity Validations (NPR context) ---
        const parsedPrice = parseFloat(ticketPrice) || 0;
        if (parsedPrice < 0 || parsedPrice > 100000) {
            const categories = await Category.find();
            return res.render('admin/createEvent', {
                error: 'Ticket price must be between NPR 0 and NPR 100,000',
                event: req.body,
                categories
            });
        }

        const parsedCapacity = parseInt(maxCapacity) || 0;
        if (parsedCapacity < 1 || parsedCapacity > 100000) {
            const categories = await Category.find();
            return res.render('admin/createEvent', {
                error: 'Event capacity must be between 1 and 100,000 attendees',
                event: req.body,
                categories
            });
        }

        // --- Date Validation: Cannot go past today ---
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
 
        if (start < today) {
            const categories = await Category.find();
            return res.render('admin/createEvent', {
                error: 'Start date cannot be in the past',
                event: req.body,
                categories
            });
        }

        // Check if start time is in the past for today
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const minDateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        if (startDate === minDateStr && startTime < currentTime) {
            const categories = await Category.find();
            return res.render('admin/createEvent', {
                error: 'Start time cannot be in the past for events starting today',
                event: req.body,
                categories
            });
        }
 
        if (end < start) {
            const categories = await Category.find();
            return res.render('admin/createEvent', {
                error: 'End date cannot be before start date',
                event: req.body,
                categories
            });
        }

        if (startDate === endDate && startTime >= endTime) {
            const categories = await Category.find();
            return res.render('admin/createEvent', {
                error: 'End time must be after start time for same-day events',
                event: req.body,
                categories
            });
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
            maxCapacity: parsedCapacity,
            ticketPrice: parsedPrice,
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

        try {
            const { syncDatabase } = require('../utils/bookingStatus');
            await syncDatabase();
        } catch (syncErr) {
            console.error('Error syncing database after event creation:', syncErr);
        }

        req.flash('success', 'Event created successfully!');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Error creating event:', err);
        const categories = await Category.find();
        res.render('admin/createEvent', {
            error: err.message || 'Failed to create event',
            event: req.body,
            categories
        });
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
        // --- Ticket Price and Capacity Validations (NPR context) ---
        const parsedPrice = parseFloat(ticketPrice) || 0;
        if (parsedPrice < 0 || parsedPrice > 100000) {
            const categories = await Category.find();
            return res.render('admin/editEvent', {
                error: 'Ticket price must be between NPR 0 and NPR 100,000',
                event: { ...req.body, _id: req.params.id, imagePath: event.imagePath },
                categories
            });
        }

        const parsedCapacity = parseInt(maxCapacity) || 0;
        if (parsedCapacity < 1 || parsedCapacity > 100000) {
            const categories = await Category.find();
            return res.render('admin/editEvent', {
                error: 'Event capacity must be between 1 and 100,000 attendees',
                event: { ...req.body, _id: req.params.id, imagePath: event.imagePath },
                categories
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
 
        if (start < today) {
            const categories = await Category.find();
            return res.render('admin/editEvent', {
                error: 'Start date cannot be in the past',
                event: { ...req.body, _id: req.params.id, imagePath: event.imagePath },
                categories
            });
        }

        // Check if start time is in the past for today
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const minDateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        if (startDate === minDateStr && startTime < currentTime) {
            const categories = await Category.find();
            return res.render('admin/editEvent', {
                error: 'Start time cannot be in the past for events starting today',
                event: { ...req.body, _id: req.params.id, imagePath: event.imagePath },
                categories
            });
        }
 
        if (end < start) {
            const categories = await Category.find();
            return res.render('admin/editEvent', {
                error: 'End date cannot be before start date',
                event: { ...req.body, _id: req.params.id, imagePath: event.imagePath },
                categories
            });
        }

        if (startDate === endDate && startTime >= endTime) {
            const categories = await Category.find();
            return res.render('admin/editEvent', {
                error: 'End time must be after start time for same-day events',
                event: { ...req.body, _id: req.params.id, imagePath: event.imagePath },
                categories
            });
        }
 
        event.eventName = eventName;
        event.description = description;
        event.categoryId = categoryId;
        event.startDate = startDate;
        event.startTime = startTime;
        event.endDate = endDate;
        event.endTime = endTime;
        event.location = location;
        event.maxCapacity = parsedCapacity;
        event.ticketPrice = parsedPrice;
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

        try {
            const { syncDatabase } = require('../utils/bookingStatus');
            await syncDatabase();
        } catch (syncErr) {
            console.error('Error syncing database after event update:', syncErr);
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
                { referenceNumber: { $regex: search, $options: 'i' } },
                { attendeeNames: { $regex: search, $options: 'i' } }
            ];
        }

        const totalItems = await Booking.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const bookingsForStats = await Booking.find({ eventId: req.params.id, status: { $ne: 'cancelled' } });
        const totalBookings = bookingsForStats.reduce((sum, b) => sum + (b.ticketCount || 0), 0);
        const capacityPercent = event.maxCapacity > 0 ? Math.round((totalBookings / event.maxCapacity) * 100) : 0;

        // If AJAX request
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
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
            const names = (Array.isArray(b.attendeeNames) && b.attendeeNames.length > 0) ? b.attendeeNames.join(', ') : b.userName;
            csv += `"${names.replace(/"/g, '""')}","${b.userEmail}","${b.referenceNumber}","${b.status}","${b.createdAt}"\n`;
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
        const adminUser = await User.findById(req.user.userId);
        const lastRead = (adminUser && adminUser.adminLastReadNotifications) ? adminUser.adminLastReadNotifications : new Date(0);

        // Fetch last 10 event bookings
        const eventBookings = await Booking.find()
            .populate('eventId')
            .sort({ createdAt: -1 })
            .limit(10);

        // Fetch last 10 venue bookings
        const venueBookings = await VenueBooking.find()
            .populate('venueId')
            .populate('userId')
            .sort({ createdAt: -1 })
            .limit(10);

        // Normalize and merge
        const merged = [
            ...eventBookings.map(b => ({
                _id: b._id,
                type: 'event',
                userName: b.userName,
                name: b.eventId ? (b.eventId.eventName || b.eventId.title) : 'Event',
                countLabel: `${b.ticketCount} tickets`,
                createdAt: b.createdAt
            })),
            ...venueBookings.map(b => ({
                _id: b._id,
                type: 'venue',
                userName: b.userId ? b.userId.username : 'Guest',
                name: b.venueId ? b.venueId.name : 'Venue',
                countLabel: `Venue Booking`,
                createdAt: b.createdAt
            }))
        ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

        // Add isRead flag based on lastRead timestamp
        const enriched = merged.map(n => ({
            ...n,
            isRead: n.createdAt <= lastRead
        }));

        const hasUnread = enriched.some(n => !n.isRead);

        res.json({
            notifications: enriched,
            hasUnread: hasUnread
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// ─── CONTACT MESSAGES WITH AJAX SEARCH & FILTER ───────────────────
exports.getMessages = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const statusFilter = req.query.status || 'all';
        const search = req.query.search || '';

        const query = {};
        if (statusFilter !== 'all') query.status = statusFilter;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        const totalItems = await Contact.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        const messages = await Contact.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // If AJAX request
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({
                messages,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems
                }
            });
        }

        res.render('admin/messages', {
            messages,
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
        console.error('Error loading admin messages:', err);
        req.flash('error', 'Failed to load messages');
        res.redirect('/admin/dashboard');
    }
};

exports.resolveMessage = async (req, res) => {
    try {
        const message = await Contact.findById(req.params.id);
        if (!message) {
            req.flash('error', 'Message not found');
            return res.redirect('/admin/messages');
        }
        message.status = message.status === 'pending' ? 'resolved' : 'pending';
        await message.save();
        req.flash('success', `Message status updated to ${message.status}`);
        res.redirect('/admin/messages');
    } catch (err) {
        console.error('Error resolving message:', err);
        req.flash('error', 'Failed to update message');
        res.redirect('/admin/messages');
    }
};

// ─── MARK ALL NOTIFICATIONS READ (ADMIN) ───────────────────
exports.markAllNotificationsRead = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.userId, {
            adminLastReadNotifications: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking admin notifications as read:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// ─── REGISTERED USERS MANAGEMENT ──────────────────────────────
exports.getRegisteredUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const search = req.query.search || '';

        let query = { role: 'user' };
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const totalItems = await User.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        const usersList = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Fetch bookings count for each user
        const enrichedUsers = await Promise.all(usersList.map(async (user) => {
            const bookingsCount = await Booking.countDocuments({ userEmail: user.email.toLowerCase() });
            const venueBookingsCount = await VenueBooking.countDocuments({ userId: user._id });
            return {
                ...user.toObject(),
                bookingsCount,
                venueBookingsCount,
                eventBookings: bookingsCount,
                venueBookings: venueBookingsCount
            };
        }));

        // Stats for Users dashboard
        const totalUsers = await User.countDocuments({ role: 'user' });
        const newUsersThisMonth = await User.countDocuments({
            role: 'user',
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } // current month 1st
        });
        
        // Count active bookers among standard users
        const allStandardUsers = await User.find({ role: 'user' });
        let activeBookersCount = 0;
        for (const u of allStandardUsers) {
            const hasEventBooking = await Booking.exists({ userEmail: u.email.toLowerCase() });
            const hasVenueBooking = await VenueBooking.exists({ userId: u._id });
            if (hasEventBooking || hasVenueBooking) {
                activeBookersCount++;
            }
        }

        const stats = {
            totalUsers,
            joinedThisMonth: newUsersThisMonth,
            activeBookers: activeBookersCount
        };

        // If AJAX request
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({
                users: enrichedUsers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems
                }
            });
        }

        res.render('admin/manageUsers', {
            users: enrichedUsers,
            stats,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems
            },
            filters: {
                search
            }
        });
    } catch (err) {
        console.error('Error loading registered users:', err);
        req.flash('error', 'Failed to load registered users');
        res.redirect('/admin/dashboard');
    }
};

// Delete a registered user
exports.deleteRegisteredUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }

        if (user.role === 'admin') {
            req.flash('error', 'Cannot delete an administrator');
            return res.redirect('/admin/users');
        }

        await User.findByIdAndDelete(req.params.id);

        req.flash('success', 'Registered user deleted successfully');
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error deleting user:', err);
        req.flash('error', 'Failed to delete user');
        res.redirect('/admin/users');
    }
};

// Export users as CSV
exports.exportUsersCsv = async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });

        let csv = 'Username,Email,Date Joined,Total Event Bookings,Total Venue Bookings\n';
        for (const u of users) {
            const bookingsCount = await Booking.countDocuments({ userEmail: u.email });
            const venueBookingsCount = await VenueBooking.countDocuments({ userId: u._id });
            const dateJoined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
            csv += `"${u.username}","${u.email}","${dateJoined}",${bookingsCount},${venueBookingsCount}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="registered_users.csv"');
        res.send(csv);
    } catch (err) {
        console.error('Error exporting users CSV:', err);
        res.status(500).send('Failed to export CSV');
    }
};
