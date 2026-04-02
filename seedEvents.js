// just some test events to test the functionality for searching

const mongoose = require("mongoose");
const Event = require("./models/event"); // Ensure you created this model

mongoose.connect("mongodb://127.0.0.1:27017/eventManagement")
  .then(() => console.log("Connected to DB for event seeding..."))
  .catch(err => console.log(err));

const events = [
  {
    title: "Neon Horizon Music Gala",
    date: new Date("2026-03-14"),
    location: "Tokyo, Japan",
    category: "FESTIVAL",
    image: "https://i.ytimg.com/vi/a9jBIGgRMl8/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCZGUIsN8n7K_ua11wqNdZ84VEv9w",
    description: "A futuristic music experience under the neon lights."
  },
  {
    title: "Global AI Summit 2026",
    date: new Date("2026-04-02"),
    location: "San Francisco, USA",
    category: "TECH",
    image: "https://i0.wp.com/asambhav.in/wp-content/uploads/2026/02/World-AI-Summit-2026.jpeg?fit=1600%2C995&ssl=1",
    description: "The world's leading minds discussing the future of AI."
  },
  {
    title: "Minimalist Visionaries Expo",
    date: new Date("2026-05-18"),
    location: "Berlin, Germany",
    category: "ARTS",
    image: "https://expobelgrade2027.org/_next/image?url=%2Fimages%2Fexperience%2Fprogramme%2Fprogramme-hero.webp&w=3840&q=75",
    description: "An exhibition of modern architectural and artistic minimalism."
  },
  {
    title: "The 2026 Emerald Ball",
    date: new Date("2026-06-10"),
    location: "London, UK",
    category: "GALA",
    image: "https://dkmpk7k3ppdsy.cloudfront.net/0cca86ddf6b20d9011945926b0baeed5.jpg",
    description: "An exclusive night of elegance and networking."
  },
  {
    title: "Creative Leadership Intensive",
    date: new Date("2026-07-22"),
    location: "Sydney, Australia",
    category: "WORKSHOP",
    image: "https://cdn.prod.website-files.com/65e5ae1fb7482afd48d22155/6706ea5e03d5848ae30fc235_6706ea5dc8adc83e48fccf11_shutterstock_629137265-1-1024x576.jpeg",
    description: "A workshop for the next generation of creative directors."
  },
  {
    title: "Urban Athletics Championship",
    date: new Date("2026-08-05"),
    location: "New York, USA",
    category: "SPORTS",
    image: "https://d26itsb5vlqdeq.cloudfront.net/image/E8C91600-D662-27C9-2257982BE48884B8",
    description: "The ultimate urban sports competition in the heart of NYC."
  }
];

async function seedDB() {
  try {
    await Event.deleteMany({}); // Clears old data so you don't get duplicates
    await Event.insertMany(events);
    console.log("Database Seeded with 6 Incredible Events!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedDB();