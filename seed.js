const mongoose = require('mongoose');
const Event = require('./models/event');

mongoose.connect('mongodb://127.0.0.1:27017/eventManagement')
    .then(async () => {
        console.log('MongoDB connected');

        await Event.deleteMany({});

        const events = await Event.insertMany([
            {
                name: 'Neon Horizon Music Gala',
                description: 'An electrifying night of music featuring top artists from around the world. Experience stunning light shows, live performances, and an unforgettable atmosphere.',
                date: new Date('2026-06-14'),
                time: '07:00 PM',
                location: 'Tokyo, Japan',
                category: 'Festival',
                ticketPrice: 129,
                maxCapacity: 500,
                tier: 'Premium',
                status: 'active'
            },
            {
                name: 'Global AI Summit 2026',
                description: 'Join the world\'s leading AI researchers and engineers for three days of talks, workshops, and networking. Explore the future of artificial intelligence.',
                date: new Date('2026-07-05'),
                time: '09:00 AM',
                location: 'San Francisco, USA',
                category: 'Tech',
                ticketPrice: 499,
                maxCapacity: 300,
                tier: 'Standard',
                status: 'active'
            },
            {
                name: 'The 2026 Emerald Ball',
                description: 'A prestigious black-tie gala set in the heart of London. Fine dining, live orchestra, and an evening of elegance you will never forget.',
                date: new Date('2026-08-10'),
                time: '06:30 PM',
                location: 'London, UK',
                category: 'Gala',
                ticketPrice: 250,
                maxCapacity: 200,
                tier: 'Elite',
                status: 'active'
            }
        ]);

        console.log('✅ Seeded', events.length, 'events:');
        events.forEach(e => console.log(`   - ${e.name} → ID: ${e._id}`));
        console.log('\nTest URL: http://localhost:3000/events/' + events[0]._id);

        mongoose.disconnect();
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
