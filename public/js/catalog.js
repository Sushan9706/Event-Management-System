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

  let currentCategory = "all";
  let searchText = "";
  let showAllMatching = false; // Track if Load More was clicked for the CURRENT filter
  const INITIAL_LIMIT = 9;

  // --- 1. FILTERING LOGIC (Consolidated with Load More support) ---
  function applyFilters() {
    const cards = document.querySelectorAll(".event-card");
    let matchingCount = 0;
    let visibleCount = 0;

    cards.forEach((card) => {
      const name = card.querySelector(".card-name").textContent.toLowerCase();
      const location = card.querySelectorAll(".card-meta-row")[1].textContent.toLowerCase();
      const category = (card.dataset.category || "").toLowerCase().trim().replace(/\s+/g, '-');

      const matchesText = !searchText || name.includes(searchText) || location.includes(searchText) || category.replace(/-/g, ' ').includes(searchText);
      const matchesCategory = currentCategory === "all" || category === currentCategory;

      if (matchesText && matchesCategory) {
        matchingCount++;
        // Check if we should show this item based on the limit
        if (showAllMatching || matchingCount <= INITIAL_LIMIT) {
          card.classList.remove("hidden");
          card.style.display = ""; // Fallback to CSS display: flex
          visibleCount++;
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

      // Show Load More if we have more matches than the limit AND haven't clicked "Show All"
      if (loadMoreBtn) {
        if (matchingCount > INITIAL_LIMIT && !showAllMatching) {
          loadMoreBtn.style.display = "inline-flex";
        } else {
          loadMoreBtn.style.display = "none";
        }
      }
    }
  }

  heroSearch?.addEventListener("input", (e) => {
    searchText = e.target.value.trim().toLowerCase();
    showAllMatching = false; // Reset "load more" state on new search
    applyFilters();
  });

  filterSection?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("filter-tag")) return;

    document.querySelectorAll(".filter-tag").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");

    currentCategory = e.target.dataset.filter.toLowerCase().trim().replace(/\s+/g, '-');
    showAllMatching = false; // Reset on new category
    applyFilters();
  });

  // --- 2. OLD SEARCH MODAL LOGIC ---
  document.getElementById("searchBtn")?.addEventListener("click", () => {
    searchOverlay.classList.toggle("open");
    if (searchOverlay.classList.contains("open")) {
      searchInput.focus();
    }
  });

  searchOverlay?.addEventListener("click", (e) => {
    if (e.target === searchOverlay) searchOverlay.classList.remove("open");
  });

  searchInput?.addEventListener("input", (e) => {
    searchText = e.target.value.trim().toLowerCase();
    if (heroSearch) heroSearch.value = e.target.value;
    showAllMatching = false;
    applyFilters();
  });

  // --- 4. LOAD MORE ---
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
