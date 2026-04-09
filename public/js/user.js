document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".ecard");

  // --- 1. FILTER LOGIC ---
  function filterEvents() {
    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    
    cards.forEach((card) => {
      const title = card.querySelector(".ecard-title")?.textContent.toLowerCase() || "";
      const isVisible = title.includes(search);
      card.style.display = isVisible ? "block" : "none";
    });
  }

  ["searchInput"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", filterEvents);
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

  // --- 5. BOOKING CANCELLATION ---
  document.querySelectorAll('.cancel-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const eventId = btn.getAttribute('data-id');
        
        if(confirm("Are you sure you want to cancel this booking?")) {
            const response = await fetch(`/bookings/cancel/${eventId}`, { method: 'POST' });
            const data = await response.json();
            
            if(data.success) {
                window.location.reload();
            }
        }
    });
  });
});