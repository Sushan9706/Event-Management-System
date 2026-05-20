const Venue = require('../models/venueModel');
const Booking = require('../models/bookingModel');
const VenueBooking = require('../models/venueBookingModel');
const Event = require('../models/event');
const User = require('../models/user');
const mongoose = require('mongoose');

// --- MANAGE VENUES ---
exports.getManageVenues = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let query = { status: { $ne: 'archived' } };
        
        // Search filter
        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { location: { $regex: req.query.search, $options: 'i' } },
                { category: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Category filter
        if (req.query.category && req.query.category !== 'all') {
            query.category = req.query.category;
        }

        const venues = await Venue.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalVenues = await Venue.countDocuments(query);
        
        const stats = {
            totalVenues: await Venue.countDocuments({ status: { $ne: 'archived' } }),
            availableVenues: await Venue.countDocuments({ status: 'available' }),
            maintenanceVenues: await Venue.countDocuments({ status: 'maintenance' })
        };

        const pagination = {
            currentPage: page,
            totalPages: Math.ceil(totalVenues / limit),
            totalVenues
        };

        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ venues, pagination, stats });
        }

        res.render('admin/manageVenues', {
            venues,
            pagination,
            stats,
            query: req.query
        });
    } catch (err) {
        console.error('Error in getManageVenues:', err);
        req.flash('error', 'Failed to fetch venues');
        res.redirect('/admin/dashboard');
    }
};

// --- CREATE VENUE ---
exports.getCreateVenue = (req, res) => {
    res.render('admin/createVenue', {
        categories: Venue.schema.path('category').enumValues
    });
};

exports.postCreateVenue = async (req, res) => {
    try {
        const { name, description, location, category, capacity, hourlyRate, dailyRate, status } = req.body;
        
        // --- Venue Validations (NPR context) ---
        const parsedCapacity = parseInt(capacity) || 0;
        if (parsedCapacity < 1 || parsedCapacity > 50000) {
            return res.render('admin/createVenue', {
                error: 'Venue capacity must be between 1 and 50,000 persons',
                formData: req.body,
                categories: Venue.schema.path('category').enumValues
            });
        }

        const hourly = hourlyRate ? parseFloat(hourlyRate) : 0;
        if (hourlyRate && (hourly <= 0 || hourly > 50000)) {
            return res.render('admin/createVenue', {
                error: 'Hourly rate must be between NPR 1 and NPR 50,000',
                formData: req.body,
                categories: Venue.schema.path('category').enumValues
            });
        }

        const daily = dailyRate ? parseFloat(dailyRate) : 0;
        if (dailyRate && (daily <= 0 || daily > 500000)) {
            return res.render('admin/createVenue', {
                error: 'Daily rate must be between NPR 1 and NPR 500,000',
                formData: req.body,
                categories: Venue.schema.path('category').enumValues
            });
        }

        if (!hourlyRate && !dailyRate) {
            return res.render('admin/createVenue', {
                error: 'At least one rate (hourly or daily) must be provided',
                formData: req.body,
                categories: Venue.schema.path('category').enumValues
            });
        }

        const imagePath = req.file ? `/images/events/${req.file.filename}` : '/images/default-venue.png';

        const venue = new Venue({
            name,
            description,
            location,
            category,
            capacity: parsedCapacity,
            hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
            dailyRate: dailyRate ? parseFloat(dailyRate) : undefined,
            status: status || 'available',
            imagePath
        });

        await venue.save();
        req.flash('success', 'Venue created successfully');
        res.redirect('/admin/venues');
    } catch (err) {
        console.error('Error in postCreateVenue:', err);
        res.render('admin/createVenue', {
            error: err.message,
            formData: req.body,
            categories: Venue.schema.path('category').enumValues
        });
    }
};

// --- EDIT VENUE ---
exports.getEditVenue = async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id);
        if (!venue) {
            req.flash('error', 'Venue not found');
            return res.redirect('/admin/venues');
        }

        res.render('admin/editVenue', {
            venue,
            categories: Venue.schema.path('category').enumValues
        });
    } catch (err) {
        console.error('Error in getEditVenue:', err);
        res.redirect('/admin/venues');
    }
};

exports.postEditVenue = async (req, res) => {
    try {
        const { name, description, location, category, capacity, hourlyRate, dailyRate, removeImage, status } = req.body;
        const venue = await Venue.findById(req.params.id);
        
        if (!venue) {
            req.flash('error', 'Venue not found');
            return res.redirect('/admin/venues');
        }

        // --- Venue Validations (NPR context) ---
        const parsedCapacity = parseInt(capacity) || 0;
        if (parsedCapacity < 1 || parsedCapacity > 50000) {
            return res.render('admin/editVenue', {
                error: 'Venue capacity must be between 1 and 50,000 persons',
                venue: { ...req.body, _id: req.params.id, imagePath: venue.imagePath },
                categories: Venue.schema.path('category').enumValues
            });
        }

        const hourly = hourlyRate ? parseFloat(hourlyRate) : 0;
        if (hourlyRate && (hourly <= 0 || hourly > 50000)) {
            return res.render('admin/editVenue', {
                error: 'Hourly rate must be between NPR 1 and NPR 50,000',
                venue: { ...req.body, _id: req.params.id, imagePath: venue.imagePath },
                categories: Venue.schema.path('category').enumValues
            });
        }

        const daily = dailyRate ? parseFloat(dailyRate) : 0;
        if (dailyRate && (daily <= 0 || daily > 500000)) {
            return res.render('admin/editVenue', {
                error: 'Daily rate must be between NPR 1 and NPR 500,000',
                venue: { ...req.body, _id: req.params.id, imagePath: venue.imagePath },
                categories: Venue.schema.path('category').enumValues
            });
        }

        if (!hourlyRate && !dailyRate) {
            return res.render('admin/editVenue', {
                error: 'At least one rate (hourly or daily) must be provided',
                venue: { ...req.body, _id: req.params.id, imagePath: venue.imagePath },
                categories: Venue.schema.path('category').enumValues
            });
        }

        venue.name = name;
        venue.description = description;
        venue.location = location;
        venue.category = category;
        venue.capacity = parsedCapacity;
        venue.hourlyRate = hourlyRate ? parseFloat(hourlyRate) : undefined;
        venue.dailyRate = dailyRate ? parseFloat(dailyRate) : undefined;
        venue.status = status || 'available';

        if (removeImage === 'true') {
            venue.imagePath = '/images/default-venue.png';
        } else if (req.file) {
            venue.imagePath = `/images/events/${req.file.filename}`;
        }

        await venue.save();
        req.flash('success', 'Venue updated successfully');
        res.redirect('/admin/venues');
    } catch (err) {
        console.error('Error in postEditVenue:', err);
        const venueImagePath = req.params.id ? (await Venue.findById(req.params.id))?.imagePath : '';
        res.render('admin/editVenue', {
            error: err.message,
            venue: { ...req.body, _id: req.params.id, imagePath: venueImagePath },
            categories: Venue.schema.path('category').enumValues
        });
    }
};

// --- DELETE VENUE ---
exports.deleteVenue = async (req, res) => {
    try {
        const venueId = req.params.id;
        const targetVenue = await Venue.findById(venueId);
        if (!targetVenue) {
            req.flash('error', 'Venue not found');
            return res.redirect('/admin/venues');
        }

        // Logic: Cancel all upcoming event bookings at this venue
        // For this, we need to find events that use this venue's location/name
        // But since we don't have a direct link between Event and Venue yet (it's just a string in Event),
        // I'll assume we find events by location string or we just focus on the venue's own future bookings if any.
        // Wait, the requirement says: "All associated upcoming venue bookings are automatically cancelled"
        // This implies there are bookings for the venue itself.
        
        // I'll implement a basic deletion for now, and if there are venue bookings, I'll cancel them.
        // Currently, bookings are linked to events. If an event is at this venue, we should probably cancel its bookings.
        // Let's search for events that match this venue's location.
        const eventsAtVenue = await Event.find({ 
            location: { $regex: targetVenue.name, $options: 'i' },
            startDate: { $gte: new Date() }
        });

        for (const event of eventsAtVenue) {
            // Cancel bookings for this event
            const bookings = await Booking.find({ eventId: event._id, status: 'confirmed' });
            for (const booking of bookings) {
                booking.status = 'cancelled';
                await booking.save();
                
                // Notify user
                const user = await User.findOne({ email: booking.userEmail });
                if (user) {
                    user.notifications.unshift({
                        type: 'booking_cancelled',
                        eventId: event._id,
                        eventName: event.eventName || event.title,
                        message: `Your booking for ${event.eventName || event.title} has been cancelled because the venue ${targetVenue.name} is no longer available.`,
                        createdAt: new Date()
                    });
                    await user.save();
                }
            }
            // Cancel the event too?
            event.status = 'cancelled';
            await event.save();
        }

        // Cancel active venue bookings for this venue as the venue is no longer available.
        await VenueBooking.updateMany(
            {
                venueId: targetVenue._id,
                status: { $in: ['confirmed', 'pending'] }
            },
            {
                $set: {
                    status: 'cancelled',
                    paymentStatus: 'unpaid'
                }
            }
        );

        targetVenue.status = 'archived'; // Soft delete
        await targetVenue.save();

        req.flash('success', 'Venue deleted and active bookings cancelled.');
        res.redirect('/admin/venues');
    } catch (err) {
        console.error('Error in deleteVenue:', err);
        req.flash('error', 'Failed to delete venue');
        res.redirect('/admin/venues');
    }
};

// --- VIEW BOOKINGS WITH AJAX SEARCH & FILTER ---
exports.getVenueBookings = async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id);
        if (!venue) {
            req.flash('error', 'Venue not found');
            return res.redirect('/admin/venues');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const statusFilter = req.query.status || 'all';
        const search = req.query.search || '';

        // Build query
        const query = { venueId: venue._id };
        if (statusFilter !== 'all') query.status = statusFilter;

        // If search term is present, we must support searching username, email, phone, reference number
        if (search) {
            // First we need to search users matching name/email to get their IDs
            const matchingUsers = await User.find({
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            query.$or = [
                { userId: { $in: userIds } },
                { referenceNumber: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { paymentStatus: { $regex: search, $options: 'i' } }
            ];
        }

        const totalItems = await VenueBooking.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        const bookings = await VenueBooking.find(query)
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const confirmedBookingsCount = await VenueBooking.countDocuments({ venueId: venue._id, status: 'confirmed' });

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

        res.render('admin/venueBookings', {
            venue,
            bookings,
            totalConfirmed: confirmedBookingsCount,
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
        console.error('Error in getVenueBookings:', err);
        res.redirect('/admin/venues');
    }
};

// --- EXPORT BOOKINGS CSV ---
exports.exportVenueBookingsCsv = async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id);
        if (!venue) return res.status(404).send('Venue not found');

        const bookings = await VenueBooking.find({ venueId: venue._id })
            .populate('userId', 'username email')
            .sort({ createdAt: -1 });

        let csv = 'Username,Email,Venue Name,Start Date,End Date,Time Slot,Phone,Total Amount,Payment Status,Status,Booked At,Reference\n';
        bookings.forEach(b => {
            const username = b.userId && b.userId.username ? b.userId.username : 'N/A';
            const email = b.userId && b.userId.email ? b.userId.email : 'N/A';
            const startDate = b.startDate ? new Date(b.startDate).toLocaleDateString() : 'N/A';
            const endDate = b.endDate ? new Date(b.endDate).toLocaleDateString() : 'N/A';
            const bookedAt = b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A';
            const timeSlot = `${b.startTime || 'N/A'} - ${b.endTime || 'N/A'}`;
            csv += `"${username}","${email}","${venue.name}","${startDate}","${endDate}","${timeSlot}","${b.phoneNumber || 'N/A'}","${typeof b.totalAmount === 'number' ? b.totalAmount : 'N/A'}","${b.paymentStatus || 'N/A'}","${b.status || 'N/A'}","${bookedAt}","${b.referenceNumber || 'N/A'}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${venue.name.replace(/[^a-zA-Z0-9]/g, '_')}_bookings.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Error exporting venue bookings CSV:', err);
        res.status(500).send('Failed to export CSV');
    }
};
