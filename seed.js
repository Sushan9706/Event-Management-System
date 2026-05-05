require("dotenv").config();
const mongoose = require("mongoose");
const Event = require("./models/event");
const Category = require("./models/categoryModel");

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventManagement";

const defaultCategories = [
  "Music",
  "Technology",
  "Sports",
  "Arts",
  "Food and Drink",
  "Networking",
  "Education",
  "Other"
];

const seededEvents = [
  {
    eventName: "Neon Horizon Music Gala",
    description: "An electrifying night of live music, light shows, and immersive stage design.",
    startDate: "2026-06-14",
    endDate: "2026-06-14",
    startTime: "07:00 PM",
    endTime: "11:00 PM",
    location: "Tokyo, Japan",
    category: "Music",
    ticketPrice: 129,
    maxCapacity: 500,
    imagePath: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Global AI Summit 2026",
    description: "Three days of talks, workshops, and demos with AI researchers and builders.",
    startDate: "2026-07-05",
    endDate: "2026-07-07",
    startTime: "09:00 AM",
    endTime: "05:30 PM",
    location: "San Francisco, USA",
    category: "Technology",
    ticketPrice: 499,
    maxCapacity: 300,
    imagePath: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Urban Athletics Championship",
    description: "A city sports showcase featuring sprint, parkour, cycling, and street fitness events.",
    startDate: "2026-07-24",
    endDate: "2026-07-26",
    startTime: "10:00 AM",
    endTime: "07:00 PM",
    location: "New York, USA",
    category: "Sports",
    ticketPrice: 850,
    maxCapacity: 180,
    imagePath: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Monsoon Art Market",
    description: "A curated market of painters, ceramicists, textile artists, and independent makers.",
    startDate: "2026-08-12",
    endDate: "2026-08-14",
    startTime: "09:00 AM",
    endTime: "06:00 PM",
    location: "Patan Durbar Square",
    category: "Arts",
    ticketPrice: 12,
    maxCapacity: 230,
    imagePath: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Kathmandu Food Trail",
    description: "A guided tasting event with local chefs, street food stops, and evening mixers.",
    startDate: "2026-09-03",
    endDate: "2026-09-03",
    startTime: "03:00 PM",
    endTime: "09:00 PM",
    location: "Durbar Marg, Kathmandu",
    category: "Food and Drink",
    ticketPrice: 30,
    maxCapacity: 120,
    imagePath: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Founders Networking Night",
    description: "A focused networking evening for founders, operators, designers, and investors.",
    startDate: "2026-09-18",
    endDate: "2026-09-18",
    startTime: "06:00 PM",
    endTime: "09:30 PM",
    location: "QFX Civil Mall, Kathmandu",
    category: "Networking",
    ticketPrice: 18,
    maxCapacity: 160,
    imagePath: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Design Systems Bootcamp",
    description: "A practical education workshop on accessible UI systems and product workflows.",
    startDate: "2026-10-02",
    endDate: "2026-10-04",
    startTime: "10:00 AM",
    endTime: "04:00 PM",
    location: "Bhaktapur Durbar Square",
    category: "Education",
    ticketPrice: 75,
    maxCapacity: 90,
    imagePath: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1400&auto=format&fit=crop"
  },
  {
    eventName: "Heritage Cycling Tour",
    description: "A guided early-morning cycling tour through heritage routes and quiet city streets.",
    startDate: "2026-10-14",
    endDate: "2026-10-16",
    startTime: "09:00 AM",
    endTime: "06:00 PM",
    location: "Bhaktapur Durbar Square",
    category: "Other",
    ticketPrice: 22,
    maxCapacity: 100,
    imagePath: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=1400&auto=format&fit=crop"
  }
];

async function seedDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoose.connection.name}`);

    await Category.deleteMany({});
    const categories = await Category.insertMany(defaultCategories.map(name => ({ name })));
    const categoryByName = new Map(categories.map(category => [category.name, category._id]));

    await Event.deleteMany({});
    const events = await Event.insertMany(seededEvents.map(event => ({
      ...event,
      title: event.eventName,
      image: event.imagePath,
      categoryId: categoryByName.get(event.category),
      status: "upcoming"
    })));

    console.log(`Seeded ${categories.length} categories.`);
    console.log(`Seeded ${events.length} events.`);
    events.forEach(event => console.log(`- ${event.eventName}: http://localhost:3000/event/${event._id}`));
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDB();
