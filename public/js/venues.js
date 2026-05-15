/* ─────────────────────────────────────────
   public/js/venues.js
   Search · Filter · Modal logic for venues
───────────────────────────────────────── */

(function () {
  "use strict";

  /* ── Elements ── */
  const searchInput = document.getElementById("venueSearch");
  const locationFilter = document.getElementById("locationFilter");
  const clearFiltersBtn = document.getElementById("clearFilters");
  const filterBtns = document.querySelectorAll("#filters .filter-tag");
  const grid = document.getElementById("venuesGrid");
  const noResults = document.getElementById("noResults");
  const cards = () =>
    grid ? Array.from(grid.querySelectorAll(".venue-card")) : [];

  let activeFilter = "all";
  let searchQuery = "";
  let activeLocation = "all";

  /* ─────────────── SEARCH ─────────────── */
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchQuery = this.value.toLowerCase().trim();
      applyFilters();
    });
  }

  /* ─────────────── LOCATION FILTER ─────────────── */
  if (locationFilter) {
    locationFilter.addEventListener("change", function () {
      activeLocation = this.value.toLowerCase();
      applyFilters();
    });
  }

  /* ─────────────── CLEAR FILTERS ─────────────── */
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      if (locationFilter) locationFilter.value = "all";
      searchQuery = "";
      activeLocation = "all";
      activeFilter = "all";
      filterBtns.forEach(function (b) {
        b.classList.remove("active");
        if (b.dataset.filter === "all") b.classList.add("active");
      });
      applyFilters();
    });
  }

  /* ─────────────── CATEGORY FILTER ─────────────── */
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  /* ─────────────── APPLY ALL ─────────────── */
  function applyFilters() {
    var visible = 0;
    cards().forEach(function (card) {
      var cat = (card.dataset.category || "").toLowerCase();
      var name = (card.dataset.name || "").toLowerCase();
      var location = (card.dataset.location || "").toLowerCase();

      var matchCat = activeFilter === "all" || cat === activeFilter;
      var matchSearch = !searchQuery || name.includes(searchQuery) || location.includes(searchQuery);
      var matchLocation = activeLocation === "all" || location.includes(activeLocation);

      if (matchCat && matchSearch && matchLocation) {
        card.style.display = "";
        visible++;
      } else {
        card.style.display = "none";
      }
    });

    if (noResults) {
      noResults.style.display = visible === 0 ? "block" : "none";
    }
  }

  /* ─────────────── VENUE DATA BRIDGE ─────────────── */
  const dataBridge = document.getElementById("venues-data-bridge");
  const venuesData = dataBridge ? JSON.parse(dataBridge.getAttribute("data-venues")) : [];

  window.openVenueModal = function (venueId) {
    var venue = venuesData.find(function (v) {
      return String(v._id) === String(venueId);
    });
    if (!venue) return;

    var modal = document.getElementById("venueModal");
    if (!modal) return;

    document.getElementById("vModalTag").textContent =
      venue.category || "Venue";
    document.getElementById("vModalName").textContent = venue.name;
    document.getElementById("vModalLocation").innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' +
      venue.location;
    document.getElementById("vModalCapacity").innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Up to ' +
      Number(venue.capacity).toLocaleString() +
      " guests";
    document.getElementById("vModalPrice").textContent =
      "NPR " + Number(venue.ratePerDay).toLocaleString() + " / day";

    // Book button — redirect to a booking page (adjust path as needed)
    var bookBtn = document.getElementById("vModalBookBtn");
    if (bookBtn) {
      bookBtn.onclick = function () {
        window.location.href = "/venues/" + venueId + "/book";
      };
    }

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  window.closeVenueModal = function () {
    var modal = document.getElementById("venueModal");
    if (modal) modal.classList.remove("open");
    document.body.style.overflow = "";
  };

  /* ─────────────── GUEST PROMPT MODAL ─────────────── */
  window.showGuestPrompt = function () {
    var modal = document.getElementById("guestModal");
    if (modal) {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  };

  // Close modals on backdrop click
  ["venueModal", "guestModal"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", function (e) {
      if (e.target === el) {
        el.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  });

  // Close modals on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      ["venueModal", "guestModal"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.classList.remove("open");
          document.body.style.overflow = "";
        }
      });
    }
  });
})();
