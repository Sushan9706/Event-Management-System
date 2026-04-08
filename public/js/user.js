// EVENTS DATA - Ensure this matches the order of cards in your EJS or use Data-Attributes
const events = [
  { name: "Global Synergy: Design & Ethics Summit", date: "2026-10-12", location: "Berlin", category: "Tech" },
  { name: "Metropolis Night Series: Soundscapes", date: "2026-11-04", location: "Kathmandu", category: "Music" },
  { name: "The Artisan's Table: Winter Solstice", date: "2026-12-15", location: "Berlin", category: "Food" },
];

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".ecard");

  // --- 1. FILTER LOGIC ---
  function filterEvents() {
    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const date = document.getElementById("dateFilter")?.value || "";
    const location = document.getElementById("locationFilter")?.value || "";
    const category = document.getElementById("categoryFilter")?.value || "";

    cards.forEach((card, index) => {
      const event = events[index];
      if (!event) return;

      const isVisible = 
        event.name.toLowerCase().includes(search) &&
        (date === "" || event.date === date) &&
        (location === "" || event.location === location) &&
        (category === "" || event.category === category);

      card.style.display = isVisible ? "block" : "none";
    });
  }

  ["searchInput", "dateFilter", "locationFilter", "categoryFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener(id === "searchInput" ? "input" : "change", filterEvents);
  });

  // --- 2. SIDEBAR TOGGLE ---
  const avatar = document.querySelector(".avatar-circle");
  const sidebar = document.getElementById("avatarSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  const toggleSidebar = (state) => {
    sidebar?.classList.toggle("open", state);
    overlay?.classList.toggle("open", state);
  };

  avatar?.addEventListener("click", () => toggleSidebar(true));
  overlay?.addEventListener("click", () => toggleSidebar(false));

  
  // --- 4. NOTIFICATION DROPDOWN ---
  const bellBtn = document.getElementById("bellBtn");
  const bellDropdown = document.getElementById("bellDropdown");

  bellBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = bellDropdown.style.display === "none" || bellDropdown.style.display === "";
    bellDropdown.style.display = isHidden ? "block" : "none";
  });

  document.addEventListener("click", () => {
    if (bellDropdown) bellDropdown.style.display = "none";
  });

document.querySelectorAll('.cancel-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const eventId = btn.getAttribute('data-id');
        
        if(confirm("Are you sure you want to cancel this booking?")) {
            const response = await fetch(`/cancel-booking/${eventId}`, { method: 'POST' });
            const data = await response.json();
            
            if(data.success) {
                // Refresh the page to show the updated list (the event will vanish)
                window.location.reload();
            }
        }
    });
});

});