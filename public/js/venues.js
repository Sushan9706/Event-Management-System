document.addEventListener("DOMContentLoaded", () => {
    const venueSearch = document.getElementById("venueSearch");
    const venuesGrid = document.getElementById("venuesGrid");
    const noResults = document.getElementById("noResults");
    const filterSection = document.getElementById("filters");
    const avatarBtn = document.getElementById('avatarBtn');
    const avatarSidebar = document.getElementById('avatarSidebar');

    let currentFilter = "all";
    let searchText = "";
    let showAllMatching = false;
    const INITIAL_LIMIT = 9;

    const loadMoreBtn = document.getElementById("loadMoreBtn");
    const loadMoreWrap = document.getElementById("loadMoreWrap");

    function applyFilters() {
        const cards = document.querySelectorAll(".event-card");
        let matchingCount = 0;

        cards.forEach((card) => {
            const name = (card.dataset.name || "").toLowerCase();
            const location = (card.dataset.location || "").toLowerCase();
            const capacity = parseInt(card.dataset.capacity, 10) || 0;
            const category = (card.dataset.category || "").toLowerCase();

            const matchesText = !searchText || name.includes(searchText) || location.includes(searchText);
            
            let matchesFilter = true;
            if (currentFilter !== "all") {
                matchesFilter = category === currentFilter;
            }

            if (matchesText && matchesFilter) {
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

        if (matchingCount === 0) {
            if (venuesGrid) venuesGrid.style.display = "none";
            if (noResults) noResults.style.display = "block";
            if (loadMoreWrap) loadMoreWrap.style.display = "none";
        } else {
            if (venuesGrid) venuesGrid.style.display = "grid";
            if (noResults) noResults.style.display = "none";

            if (loadMoreWrap) {
                if (matchingCount > INITIAL_LIMIT && !showAllMatching) {
                    loadMoreWrap.style.display = "block";
                } else {
                    loadMoreWrap.style.display = "none";
                }
            }
        }
    }

    venueSearch?.addEventListener("input", (e) => {
        searchText = e.target.value.toLowerCase().trim();
        showAllMatching = false;
        applyFilters();
    });

    filterSection?.addEventListener("click", (e) => {
        if (!e.target.classList.contains("filter-tag")) return;

        document.querySelectorAll(".filter-tag").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");

        currentFilter = e.target.dataset.filter.toLowerCase();
        showAllMatching = false;
        applyFilters();
    });

    loadMoreBtn?.addEventListener("click", () => {
        showAllMatching = true;
        applyFilters();
        window.scrollBy({ top: 300, behavior: "smooth" });
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

    // Voice search initialization is handled by voice-search.js
    // but we can add specific logic if needed.
    // The voice-search.js already triggers 'input' event on heroSearch/venueSearch
});
