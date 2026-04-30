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
  const filterToggleBtn = document.getElementById("filterToggleBtn");
  const filterPanelBody = document.getElementById("filterPanelBody");
  const filterCountBadge = document.getElementById("filterCount");
  const filterLocation = document.getElementById("filterLocation");
  const filterDateFrom = document.getElementById("filterDateFrom");
  const filterPrice = document.getElementById("filterPrice");
  const btnApplyFilters = document.getElementById("btnApplyFilters");
  const btnClearFilters = document.getElementById("btnClearFilters");
  const activeFiltersEl = document.getElementById("activeFilters");
  const filterCategory = document.getElementById("filterCategory");

  const INITIAL_LIMIT = 9;
  let state = {
    searchText: "",
    category: "all",
    location: "",
    dateFrom: "",
    dateTo: "",
    price: "",
    showAll: false,
  };

  // --- 1. FILTERING LOGIC (Consolidated with Load More support) ---
  function applyFilters() {
    const cards = document.querySelectorAll(".event-card");
    let matchingCount = 0;

    cards.forEach((card) => {
      const name = card.querySelector(".card-name").textContent.toLowerCase();
      const location = (card.dataset.location || "").toLowerCase();
      const category = (card.dataset.category || "")
        .toLowerCase()
        .trim()
        .replace(/\\s+/g, "-");
      const dateStr = card.dataset.date || "";
      const price = parseFloat(card.dataset.price) || 0;

      const matchesSearch =
        !state.searchText ||
        name.includes(state.searchText) ||
        location.includes(state.searchText);
      const matchesCategory =
        state.category === "all" || category === state.category;
      const matchesLocation =
        !state.location || location.includes(state.location);

      let matchesDate = true;
      if (state.dateFrom && dateStr < state.dateFrom) matchesDate = false;

      let matchesPrice = true;
      if (state.price === "free" && price !== 0) matchesPrice = false;
      if (state.price === "paid" && price === 0) matchesPrice = false;
      if (state.price === "under50" && price >= 50) matchesPrice = false;
      if (state.price === "under100" && price >= 100) matchesPrice = false;
      if (state.price === "under200" && price >= 200) matchesPrice = false;

      const visible =
        matchesSearch &&
        matchesCategory &&
        matchesLocation &&
        matchesDate &&
        matchesPrice;

      if (visible) {
        matchingCount++;
        card.style.display =
          state.showAll || matchingCount <= INITIAL_LIMIT ? "" : "none";
      } else {
        card.style.display = "none";
      }
    });

    if (matchingCount === 0) {
      if (eventsGrid) eventsGrid.style.display = "none";
      if (noResults) noResults.style.display = "block";
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } else {
      if (eventsGrid) eventsGrid.style.display = "grid";
      if (noResults) noResults.style.display = "none";
      if (loadMoreBtn)
        loadMoreBtn.style.display =
          matchingCount > INITIAL_LIMIT && !state.showAll
            ? "inline-flex"
            : "none";
    }
  }

  filterSection?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("filter-tag")) return;
    document
      .querySelectorAll(".filter-tag")
      .forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");
    state.category = e.target.dataset.filter
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");
    if (filterCategory) filterCategory.value = state.category;
    state.showAll = false;
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
    state.searchText = e.target.value.trim().toLowerCase();
    if (heroSearch) heroSearch.value = e.target.value;
    showAllMatching = false;
    applyFilters();
  });
  // Filter panel toggle
  filterToggleBtn?.addEventListener("click", () => {
    filterPanelBody.classList.toggle("open");
    filterToggleBtn.classList.toggle("active");
  });

  btnApplyFilters?.addEventListener("click", () => {
    console.log("Apply button clicked"); // 👈 check this in console
  
    state.location = filterLocation.value.trim().toLowerCase();
    state.dateFrom = filterDateFrom.value;
    state.price = filterPrice.value;
    state.category = filterCategory.value;
    state.showAll = false;
  
    renderChips();
    applyFilters();
  });

  btnClearFilters?.addEventListener("click", () => {
    filterLocation.value = "";
    filterDateFrom.value = "";
    filterPrice.value = "";
    state.location = "";
    state.dateFrom = "";
    state.dateTo = "";
    state.price = "";
    state.showAll = false;
    filterCategory.value = "all";
    state.category = "all";
    document
      .querySelectorAll(".filter-tag")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelector(".filter-tag[data-filter='all']")
      .classList.add("active");
    updateFilterBadge();
    renderChips();
    applyFilters();
  });

  function updateFilterBadge() {
    // no-op: filterCountBadge and filterToggleBtn don't exist in HTML
  }

  function renderChips() {
    activeFiltersEl.innerHTML = "";
    const chips = [];
    if (state.location)
      chips.push({ label: `📍 ${state.location}`, key: "location" });
    if (state.dateFrom && state.dateTo)
      chips.push({
        label: `📅 ${state.dateFrom} → ${state.dateTo}`,
        key: "dateRange",
      });
    else if (state.dateFrom)
      chips.push({ label: `📅 From ${state.dateFrom}`, key: "dateFrom" });
    else if (state.dateTo)
      chips.push({ label: `📅 Until ${state.dateTo}`, key: "dateTo" });
    if (state.price) {
      const labels = {
        free: "Free",
        paid: "Paid",
        under50: "< $50",
        under100: "< $100",
        under200: "< $200",
      };
      chips.push({ label: `💰 ${labels[state.price]}`, key: "price" });
    }
    if (state.category !== "all") {
      chips.push({ label: `🏷️ ${state.category}`, key: "category" });
    }
    if (!chips.length) {
      activeFiltersEl.classList.remove("visible");
      return;
    }
    activeFiltersEl.classList.add("visible");
    chips.forEach((chip) => {
      const el = document.createElement("span");
      el.className = "filter-chip";
      el.innerHTML = `${chip.label} <button>×</button>`;
      el.querySelector("button").addEventListener("click", () => {
        if (chip.key === "location") {
          state.location = "";
          filterLocation.value = "";
        }
        if (chip.key === "dateFrom") {
          state.dateFrom = "";
          filterDateFrom.value = "";
        }
        if (chip.key === "dateTo") {
          state.dateTo = "";
        }
        if (chip.key === "dateRange") {
          state.dateFrom = "";
          state.dateTo = "";
          filterDateFrom.value = "";
        }
        if (chip.key === "price") {
          state.price = "";
          filterPrice.value = "";
        }
        if (chip.key === "category") {
          state.category = "all";
          filterCategory.value = "all";
          document
            .querySelectorAll(".filter-tag")
            .forEach((t) => t.classList.remove("active"));
          document
            .querySelector(".filter-tag[data-filter='all']")
            .classList.add("active");
        }
        state.showAll = false;
        updateFilterBadge();
        renderChips();
        applyFilters();
      });
      activeFiltersEl.appendChild(el);
    });
  }

  // --- 3. DROPDOWN LOGIC ---
  avatarBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarSidebar.classList.toggle("open");
    notifDropdown?.classList.remove("open");
  });

  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle("open");
    avatarSidebar?.classList.remove("open");
  });

  document.addEventListener("click", (e) => {
    if (!avatarSidebar?.contains(e.target) && !avatarBtn?.contains(e.target)) {
      avatarSidebar?.classList.remove("open");
    }
    if (!notifDropdown?.contains(e.target) && !notifBtn?.contains(e.target)) {
      notifDropdown?.classList.remove("open");
    }
    if (filterPanelBody?.classList.contains("open")) {
      if (
        !filterPanelBody.contains(e.target) &&
        !filterToggleBtn?.contains(e.target)
      ) {
        if (filterPanelBody?.classList.contains("open")) {

      }
    }
  });


  // --- 4. LOAD MORE ---
  loadMoreBtn?.addEventListener("click", () => {
    state.showAll = true;
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
      filterPanelBody?.classList.remove("open");
      filterToggleBtn?.classList.remove("active");
    }
  });

  // Initial Run
  applyFilters();
});

heroSearch?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    state.searchText = e.target.value.trim().toLowerCase();
    applyFilters();
  }
});
