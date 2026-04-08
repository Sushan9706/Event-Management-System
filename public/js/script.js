document.addEventListener("DOMContentLoaded", () => {
  console.log("Event Management System - Frontend loaded successfully!");
});
const events = [
  {
    name: "Global Synergy: Design & Ethics Summit",
    date: "2026-10-12",
    location: "Berlin",
    category: "Tech",
  },
  {
    name: "Metropolis Night Series: Soundscapes",
    date: "2026-11-04",
    location: "Kathmandu",
    category: "Music",
  },
  {
    name: "The Artisan's Table: Winter Solstice",
    date: "2026-12-15",
    location: "Berlin",
    category: "Food",
  },
];

const cards = document.querySelectorAll(".ecard");

function filterEvents() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const date = document.getElementById("dateFilter").value;
  const location = document.getElementById("locationFilter").value;
  const category = document.getElementById("categoryFilter").value;

  cards.forEach((card, index) => {
    const event = events[index];

    const match =
      event.name.toLowerCase().includes(search) &&
      (date === "" || event.date === date) &&
      (location === "" || event.location === location) &&
      (category === "" || event.category === category);

    card.style.display = match ? "block" : "none";
  });
}

document.getElementById("searchInput").addEventListener("input", filterEvents);
document.getElementById("dateFilter").addEventListener("change", filterEvents);
document
  .getElementById("locationFilter")
  .addEventListener("change", filterEvents);
document
  .getElementById("categoryFilter")
  .addEventListener("change", filterEvents);
