const Venue = require('../models/venueModel');
const userModel = require('../models/user');
const VenueBooking = require('../models/venueBookingModel');

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

        // Fetch existing bookings to show availability
        const bookings = await VenueBooking.find({ 
            venueId: req.params.id,
            status: { $ne: 'cancelled' }
        }).select('startDate endDate').lean();

        // Expand ranges into individual days for the calendar
        const bookedDates = [];
        bookings.forEach(b => {
            let curr = new Date(b.startDate);
            const end = new Date(b.endDate);
            // Ensure we include the end date by comparing properly
            while (curr <= end) {
                bookedDates.push(new Date(curr).toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }
        });

        res.render('venueDetail', { 
            venue, 
            user: req.user || null,
            bookedDates: JSON.stringify(bookedDates)
        });
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
            queryObj.name = { $regex: q, $options: "i" };
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

exports.bookVenue = async (req, res) => {
    try {
        const { venueId, startDate, endDate, startTime, endTime } = req.body;
        const userId = req.user.userId;

        const venue = await Venue.findById(venueId);
        if (!venue) return res.status(404).json({ success: false, message: "Venue not found" });

        // Check if any date in the range is already booked
        const existingBookings = await VenueBooking.find({
            venueId,
            status: { $ne: 'cancelled' },
            $or: [
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
            ]
        });

        if (existingBookings.length > 0) {
            return res.status(400).json({ success: false, message: "Venue is already booked for some dates in this range." });
        }

        // Calculate days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Calculate total amount based on daily or hourly rate
        let totalAmount = 0;
        if (venue.dailyRate) {
            totalAmount = venue.dailyRate * diffDays;
        } else if (venue.hourlyRate) {
            // Simple hourly calculation: (endTime - startTime) * days * rate
            const startT = startTime.split(':');
            const endT = endTime.split(':');
            const hours = (parseInt(endT[0]) + parseInt(endT[1])/60) - (parseInt(startT[0]) + parseInt(startT[1])/60);
            const totalHours = Math.max(hours, 0) * diffDays;
            totalAmount = venue.hourlyRate * totalHours;
        }

        const referenceNumber = 'V-EMS-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        const newBooking = await VenueBooking.create({
            venueId,
            userId,
            startDate,
            endDate,
            startTime,
            endTime,
            totalAmount,
            status: 'confirmed',
            paymentStatus: 'paid',
            referenceNumber
        });

        res.json({ success: true, message: "Venue booked successfully!", booking: newBooking });
    } catch (err) {
        console.error("Booking error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
