document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".ecard");

  // --- 1. FILTER LOGIC ---
  function filterEvents() {
    const search =
      document.getElementById("searchInput")?.value.toLowerCase() || "";

    cards.forEach((card) => {
      const title =
        card.querySelector(".ecard-title")?.textContent.toLowerCase() ||
        card.querySelector(".ecard-title--sm")?.textContent.toLowerCase() ||
        "";
      const isVisible = title.includes(search);
      card.style.display = isVisible ? "block" : "none";
    });
  }

  document
    .getElementById("searchInput")
    ?.addEventListener("input", filterEvents);

  // --- 2. SIDEBAR TOGGLE ---
  const avatar =
    document.getElementById("profileTrigger") ||
    document.querySelector(".avatar-circle");
  const sidebar = document.getElementById("avatarSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  const toggleSidebar = (state) => {
    if (sidebar && overlay) {
      sidebar.classList.toggle("open", state);
      overlay.classList.toggle("open", state);
    }
  };

  avatar?.addEventListener("click", () => toggleSidebar(true));
  overlay?.addEventListener("click", () => toggleSidebar(false));

  // --- 3. NOTIFICATION DROPDOWN ---
  // --- 3. NOTIFICATION DROPDOWN ---
  const notifBtn = document.getElementById("notifBtn");
  const notifDropdown = document.getElementById("notifDropdown");

  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle("open");

    // Auto mark all as read when panel opens
    if (notifDropdown?.classList.contains("open")) {
      fetch("/notifications/mark-all-read", {
        method: "POST",
        credentials: "same-origin",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            document
              .querySelectorAll(".notif-item--unread")
              .forEach((el) => el.classList.remove("notif-item--unread"));
            const dot = document.querySelector(".notif-dot");
            if (dot) dot.style.display = "none";
            const badge = document.querySelector(".notif-badge");
            if (badge) badge.style.display = "none";
            const markAllBtn = document.getElementById("markAllReadBtn");
            if (markAllBtn) markAllBtn.style.display = "none";
          }
        })
        .catch((err) => console.error("Auto mark read failed:", err));
    }
  });

  document.addEventListener("click", (e) => {
    if (!notifDropdown) return;
    if (!notifDropdown.contains(e.target) && !notifBtn?.contains(e.target)) {
      notifDropdown.classList.remove("open");
    }
  });

  // --- 4. BOOKING CANCELLATION ---
  document.querySelectorAll(".cancel-trigger").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const eventId = btn.getAttribute("data-id");

      if (confirm("Are you sure you want to cancel this booking?")) {
        try {
          const response = await fetch(`/bookings/cancel/${eventId}`, {
            method: "POST",
          });
          const data = await response.json();
          if (data.success) {
            window.location.reload();
          }
        } catch (err) {
          console.error("Cancellation failed", err);
        }
      }
    });
  });
});

async function markAsRead(notifId) {
  try {
    await fetch(`/notifications/mark-as-read/${notifId}`, { method: "POST" });
    // Optional: update UI without reload if needed, but reload is simpler for now
    // to update the unread dot and other counters if any.
    // window.location.reload();
  } catch (err) {
    console.error("Failed to mark notification as read", err);
  }
}
