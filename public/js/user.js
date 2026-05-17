document.addEventListener("DOMContentLoaded", () => {
    // --- 1. GLOBAL ELEMENTS ---
    const profileTrigger = document.getElementById("profileTrigger") || document.querySelector(".avatar-circle");
    const avatarSidebar = document.getElementById("avatarSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const notifBtn = document.getElementById("notifBtn") || document.getElementById("bellBtn");
    const notifDropdown = document.getElementById("notifDropdown") || document.getElementById("bellDropdown");

    // --- 2. SIDEBAR TOGGLE ---
    const toggleSidebar = (state) => {
        if (avatarSidebar && sidebarOverlay) {
            if (state) {
                avatarSidebar.classList.add("open");
                sidebarOverlay.classList.add("open");
            } else {
                avatarSidebar.classList.remove("open");
                sidebarOverlay.classList.remove("open");
            }
        }
    };

    if (profileTrigger) {
        profileTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleSidebar(true);
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", () => toggleSidebar(false));
    }

    // --- 3. NOTIFICATION DROPDOWN ---
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("open");
            // Also close sidebar if open
            toggleSidebar(false);
            
            const dot = notifBtn.querySelector(".notif-dot");
            if (dot && notifDropdown.classList.contains("open")) {
                try {
                    const res = await fetch("/api/notifications/read", { method: "POST" });
                    if (res.ok) dot.remove();
                } catch(err) { console.error(err); }
            }
        });

        document.addEventListener("click", (e) => {
            if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDropdown.classList.remove("open");
            }
        });
    }

    // --- 4. DASHBOARD SPECIFIC (Graceful fallback) ---
    const cards = document.querySelectorAll(".ecard");
    const searchInput = document.getElementById("searchInput");

    if (cards.length > 0 && searchInput) {
        searchInput.addEventListener("input", () => {
            const search = searchInput.value.toLowerCase();
            cards.forEach((card) => {
                const title = card.querySelector(".ecard-title")?.textContent.toLowerCase() || 
                              card.querySelector(".ecard-title--sm")?.textContent.toLowerCase() || "";
                card.style.display = title.includes(search) ? "block" : "none";
            });
        });
    }

    // --- 5. BOOKING CANCELLATION (Graceful fallback) ---
    document.querySelectorAll('.cancel-trigger').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const eventId = btn.getAttribute('data-id');
            if(confirm("Are you sure you want to cancel this booking?")) {
                try {
                    const response = await fetch(`/bookings/cancel/${eventId}`, { method: 'POST' });
                    const data = await response.json();
                    if(data.success) window.location.reload();
                } catch (err) {
                    console.error("Cancellation failed", err);
                }
            }
        });
    });

    // --- 6. LOGOUT CONFIRMATION ---
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            if (!confirm("Are you sure you want to log out?")) {
                e.preventDefault();
            }
        });
    }
});
