const Venue = require("../models/venueModel");

// GET /venues
const getVenues = async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    // Build filter — only show active venues
    const filter = { isActive: true };

    if (category && category !== "All") {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort
    let sortOption = { name: 1 }; // default A-Z
    if (sort === "name-desc") sortOption = { name: -1 };
    if (sort === "capacity-desc") sortOption = { capacity: -1 };
    if (sort === "rate-asc") sortOption = { rate: 1 };
    if (sort === "rate-desc") sortOption = { rate: -1 };

    const venues = await Venue.find(filter).sort(sortOption);

    const categories = [
      "All",
      "Conference",
      "Banquet",
      "Outdoor",
      "Studio",
      "Workshop",
    ];

    res.render("venues", {
      venues,
      categories,
      currentCategory: category || "All",
      currentSort: sort || "name-asc",
      search: search || "",
      user: req.user || null,
    });
  } catch (err) {
    console.error("getVenues error:", err);
    res.status(500).send("Server error");
  }
};

module.exports = { getVenues };
