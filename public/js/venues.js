document.addEventListener("DOMContentLoaded", () => {
    const venueSearch = document.getElementById("venueSearch");
    const venuesGrid = document.getElementById("venuesGrid");
    const noResults = document.getElementById("noResults");
    const filterSection = document.getElementById("filters");
    let currentFilter = "all";
    let searchText = "";

    function applyFilters() {
        const cards = document.querySelectorAll(".event-card");
        let matchingCount = 0;

        cards.forEach((card) => {
            const name = (card.dataset.name || "").toLowerCase();
            const location = (card.dataset.location || "").toLowerCase();
            const capacity = parseInt(card.dataset.capacity, 10) || 0;

            const matchesText = !searchText || name.includes(searchText) || location.includes(searchText);
            
            let matchesFilter = true;
            if (currentFilter === "large") matchesFilter = capacity >= 500;
            else if (currentFilter === "medium") matchesFilter = capacity >= 100 && capacity < 500;
            else if (currentFilter === "small") matchesFilter = capacity < 100;

            if (matchesText && matchesFilter) {
                card.style.display = "";
                matchingCount++;
            } else {
                card.style.display = "none";
            }
        });

        if (matchingCount === 0) {
            venuesGrid.style.display = "none";
            noResults.style.display = "block";
        } else {
            venuesGrid.style.display = "grid";
            noResults.style.display = "none";
        }
    }

    venueSearch?.addEventListener("input", (e) => {
        searchText = e.target.value.toLowerCase().trim();
        applyFilters();
    });

    filterSection?.addEventListener("click", (e) => {
        if (!e.target.classList.contains("filter-tag")) return;

        document.querySelectorAll(".filter-tag").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");

        currentFilter = e.target.dataset.filter;
        applyFilters();
    });

    // Handle redirection to details page
    document.querySelectorAll(".event-card").forEach((card) => {
        card.addEventListener("click", () => {
            const venueId = card.dataset.id;
            if (venueId) window.location.href = `/venue/${venueId}`;
        });
    });

    document.querySelectorAll(".btn-details").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const card = btn.closest(".event-card");
            const venueId = card.dataset.id;
            if (venueId) window.location.href = `/venue/${venueId}`;
        });
    });

    applyFilters();

    // Voice search initialization is handled by voice-search.js
    // but we can add specific logic if needed.
    // The voice-search.js already triggers 'input' event on heroSearch/venueSearch
});
