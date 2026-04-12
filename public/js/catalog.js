document.addEventListener("DOMContentLoaded", () => {
  // --- ELEMENTS ---
  const searchOverlay = document.getElementById("searchOverlay");
  const searchInput = document.getElementById("searchInput");
  const notifDropdown = document.getElementById("notifDropdown");
  const avatarSidebar = document.getElementById("avatarSidebar");
  const avatarBtn = document.getElementById("avatarBtn");
  const notifBtn = document.getElementById("notifBtn");

  // --- 1. SEARCH LOGIC ---
  document.getElementById("searchBtn")?.addEventListener("click", () => {
    searchOverlay.classList.toggle("open");
    if (searchOverlay.classList.contains("open")) {
      searchInput.focus();
    }
  });

  searchOverlay?.addEventListener("click", (e) => {
    if (e.target === searchOverlay) searchOverlay.classList.remove("open");
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleHeroSearch(searchInput.value);
      searchOverlay.classList.remove("open");
    }
  });

  document.getElementById("findBtn")?.addEventListener("click", () => {
    const val = document.getElementById("heroSearch").value;
    handleHeroSearch(val);
  });

  document.getElementById("heroSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleHeroSearch(e.target.value);
    }
  });

  function handleHeroSearch(value) {
    const val = value.trim().toLowerCase();
    const cards = document.querySelectorAll(".event-card");

    cards.forEach((card) => {
      const name = card.querySelector(".card-name").textContent.toLowerCase();
      const location = card.querySelectorAll(".card-meta-row")[1].textContent.toLowerCase();

      if (!val || name.includes(val) || location.includes(val)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });

    document.querySelector(".events-section")?.scrollIntoView({ behavior: "smooth" });
  }

  // --- 2. DROPDOWN LOGIC (NOTIFICATIONS & PROFILE) ---
  // Improved to handle the new compact design
  avatarBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarSidebar.classList.toggle("open");
    notifDropdown?.classList.remove("open"); // Close notifications if profile is opened
  });

  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle("open");
    avatarSidebar?.classList.remove("open"); // Close profile if notifications are opened
  });

  // Global click listener to close dropdowns when clicking away
  document.addEventListener("click", (e) => {
    if (!avatarSidebar?.contains(e.target) && !avatarBtn?.contains(e.target)) {
      avatarSidebar?.classList.remove("open");
    }
    if (!notifDropdown?.contains(e.target) && !notifBtn?.contains(e.target)) {
      notifDropdown?.classList.remove("open");
    }
  });

  // --- 3. FILTERING LOGIC ---
  document.getElementById("filters")?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("filter-tag")) return;

    document.querySelectorAll(".filter-tag").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");

    const filter = e.target.dataset.filter;

    document.querySelectorAll(".event-card").forEach((card) => {
      const match = filter === "all" || card.dataset.category === filter;
      card.style.display = match ? "block" : "none";
    });
  });

  // --- 4. LOAD MORE ---
  document.getElementById("loadMoreBtn")?.addEventListener("click", () => {
    document.querySelectorAll(".event-card.hidden").forEach((c) => {
      c.classList.remove("hidden");
    });
    document.getElementById("loadMoreBtn").style.display = "none";
    window.scrollBy({ top: 300, behavior: "smooth" });
  });

  window.confirmBooking = async function() {
    if (!currentCard) return;

    const eventId = currentCard.dataset.id;
    const name = currentCard.querySelector(".card-name").textContent;
    const rows = currentCard.querySelectorAll(".card-meta-row");
    const date = rows[0].textContent.trim();
    const location = rows[1].textContent.trim();

    try {
      const response = await fetch('/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      });

      const data = await response.json();

      if (data.success) {
        document.getElementById("bookingEventName").textContent = name;
        document.getElementById("bookingDetail").textContent =
          date + " · " + location + " (Ref: " + data.referenceNumber + ")";
        
        closeModal();
        document.getElementById("bookingModal").classList.add("open");
      } else {
        alert(data.message || 'Booking failed');
        closeModal();
      }
    } catch (err) {
      console.error('Booking Error:', err);
      alert('Something went wrong. Please try again.');
    }
  };

  window.closeBooking = function() {
    document.getElementById("bookingModal").classList.remove("open");
    window.location.href = "/user";
  };


document.querySelectorAll(".btn-details").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent double trigger
    const card = btn.closest(".event-card");
    const eventId = card.dataset.id;

    if (eventId) {
      window.location.href = `/event/${eventId}`;
    }
  });
});

document.querySelectorAll(".event-card").forEach((card) => {
  card.addEventListener("click", () => {
    const eventId = card.dataset.id;
    if (eventId) {
      window.location.href = `/event/${eventId}`;
    }
  });
});

  // --- 6. UTILITIES ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchOverlay?.classList.remove("open");
      notifDropdown?.classList.remove("open");
      avatarSidebar?.classList.remove("open");
      closeModal();
    }
  });
});