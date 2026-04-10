const mongoose = require("mongoose");
const Category = require("./models/categoryModel");

mongoose.connect("mongodb://127.0.0.1:27017/eventManagement")
  .then(() => console.log("✅ Connected to DB for category seeding..."))
  .catch(err => console.log(err));

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

async function seedDB() {
  try {
    // Seed Categories
    await Category.deleteMany({});
    await Category.insertMany(defaultCategories);
    console.log("✅ Categories Seeded successfully!");
    
    // We are no longer seeding manual events as they should only be created from the admin panel.
    console.log("ℹ️ Manual events seeding has been removed per instructions.");
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedDB();