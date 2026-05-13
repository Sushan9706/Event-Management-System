document.addEventListener("DOMContentLoaded", () => {
  // --- ELEMENTS ---
  const searchOverlay = document.getElementById("searchOverlay");
  const searchInput = document.getElementById("searchInput");
  const notifDropdown = document.getElementById("notifDropdown");
  const avatarSidebar = document.getElementById("avatarSidebar");
  const avatarBtn = document.getElementById("avatarBtn");
  const notifBtn = document.getElementById("notifBtn");
  const heroSearch = document.getElementById("heroSearch");
  const eventsGrid = document.getElementById("eventsGrid");
  const noResults = document.getElementById("noResults");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const filterSection = document.getElementById("filters");
  const locationFilter = document.getElementById("locationFilter");
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  let currentCategory = "all";
  let searchText = "";
  let locationText = "";
  let startDate = null;
  let endDate = null;
  let showAllMatching = false;
  const INITIAL_LIMIT = 9;

  // --- 1. FILTERING LOGIC ---
  function applyFilters() {
    const cards = document.querySelectorAll(".event-card");
    let matchingCount = 0;

    cards.forEach((card) => {
      const name = card.querySelector(".card-name").textContent.toLowerCase();
      const cardLocation = card.querySelectorAll(".card-meta-row")[1].textContent.toLowerCase();
      const category = (card.dataset.category || "").toLowerCase().trim().replace(/\s+/g, '-');
      const cardDate = new Date(card.dataset.date);

      // Matches Logic
      const matchesText = !searchText || name.includes(searchText) || cardLocation.includes(searchText) || category.replace(/-/g, ' ').includes(searchText);
      const matchesCategory = currentCategory === "all" || category === currentCategory;
      const matchesLocation = !locationText || cardLocation.includes(locationText);
      
      let matchesDate = true;
      if (startDate) {
        const dFrom = new Date(startDate);
        dFrom.setHours(0,0,0,0);
        matchesDate = matchesDate && cardDate >= dFrom;
      }
      if (endDate) {
        const dTo = new Date(endDate);
        dTo.setHours(23,59,59,999);
        matchesDate = matchesDate && cardDate <= dTo;
      }

      if (matchesText && matchesCategory && matchesLocation && matchesDate) {
        matchingCount++;
        if (showAllMatching || matchingCount <= INITIAL_LIMIT) {
          card.style.display = ""; 
        } else {
          card.style.display = "none";
        }
      } else {
        card.style.display = "none";
      }
    });

    // Handle Empty State
    if (matchingCount === 0) {
      if (eventsGrid) eventsGrid.style.display = "none";
      if (noResults) noResults.style.display = "block";
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } else {
      if (eventsGrid) eventsGrid.style.display = "grid";
      if (noResults) noResults.style.display = "none";
      if (loadMoreBtn) {
        loadMoreBtn.style.display = (matchingCount > INITIAL_LIMIT && !showAllMatching) ? "inline-flex" : "none";
      }
    }
  }

  // --- 2. EVENT LISTENERS ---
  heroSearch?.addEventListener("input", (e) => {
    searchText = e.target.value.trim().toLowerCase();
    showAllMatching = false;
    applyFilters();
  });

  locationFilter?.addEventListener("input", (e) => {
    locationText = e.target.value.trim().toLowerCase();
    showAllMatching = false;
    applyFilters();
  });

  dateFrom?.addEventListener("change", (e) => {
    startDate = e.target.value;
    showAllMatching = false;
    applyFilters();
  });

  dateTo?.addEventListener("change", (e) => {
    endDate = e.target.value;
    showAllMatching = false;
    applyFilters();
  });

  filterSection?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("filter-tag")) return;
    document.querySelectorAll(".filter-tag").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.dataset.filter.toLowerCase().trim().replace(/\s+/g, '-');
    showAllMatching = false;
    applyFilters();
  });

  clearFiltersBtn?.addEventListener("click", () => {
    // Reset Variables
    searchText = "";
    locationText = "";
    currentCategory = "all";
    startDate = null;
    endDate = null;
    showAllMatching = false;

    // Reset UI
    if (heroSearch) heroSearch.value = "";
    if (locationFilter) locationFilter.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    document.querySelectorAll(".filter-tag").forEach((t) => {
      t.classList.remove("active");
      if (t.dataset.filter === "all") t.classList.add("active");
    });

    applyFilters();
  });

  // --- 3. LOAD MORE ---
  loadMoreBtn?.addEventListener("click", () => {
    showAllMatching = true;
    applyFilters();
    window.scrollBy({ top: 300, behavior: "smooth" });
  });

  // --- 5. REDIRECTS ---
  document.querySelectorAll(".btn-details").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".event-card");
      const eventId = card.dataset.id;
      if (eventId) window.location.href = `/event/${eventId}`;
    });
  });

  document.querySelectorAll(".event-card").forEach((card) => {
    card.addEventListener("click", () => {
      const eventId = card.dataset.id;
      if (eventId) window.location.href = `/event/${eventId}`;
    });
  });

  // --- 6. ESCAPE KEY ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchOverlay?.classList.remove("open");
      notifDropdown?.classList.remove("open");
      avatarSidebar?.classList.remove("open");
    }
  });

  // Initial Run
  applyFilters();
});
