document.addEventListener("DOMContentLoaded", () => {
    // If logged in as admin, let admin-notif.js handle navbar/dropdown to avoid script collision
    if (document.body.getAttribute("data-role") === "admin") {
        return;
    }

    // --- 1. GLOBAL ELEMENTS ---
    const profileTrigger = document.getElementById("profileTrigger") || document.querySelector(".avatar-circle");
    const avatarSidebar = document.getElementById("avatarSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const notifBtn = document.getElementById("notifBtn") || document.getElementById("bellBtn");
    const notifDropdown = document.getElementById("notifDropdown") || document.getElementById("bellDropdown");

    // Fix default/broken avatar image fallback dynamically and gracefully
    if (profileTrigger && profileTrigger.tagName === "IMG") {
        const currentSrc = profileTrigger.getAttribute("src");
        if (!currentSrc || currentSrc.includes("tinyurl.com") || currentSrc.includes("ui-avatars.com")) {
            profileTrigger.setAttribute("src", `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="background:%23f1f5f9;width:100%;height:100%;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`);
        }
    }

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
            if (notifDropdown) {
                notifDropdown.classList.remove("open");
            }
            toggleSidebar(true);
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", () => toggleSidebar(false));
    }

    // --- 3. NOTIFICATION DROPDOWN ---
    if (notifBtn && notifDropdown) {
        let hasUnreadNotifications = false;

        // Initialize basic structure
        notifDropdown.innerHTML = `
            <div class="notif-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-top-left-radius: 12px; border-top-right-radius: 12px;">
                <span class="notif-title" style="padding: 0 !important; margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #64748b; text-transform: uppercase;">Notifications</span>
                <button id="markAllReadBtn" class="mark-all-read-btn" style="background: none; border: none; font-size: 11px; font-weight: 600; color: #64748b; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: all 0.2s;">Mark all as Read</button>
            </div>
            <div id="notifList" style="max-height: 320px; overflow-y: auto;">
                <p class="notif-empty" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; margin: 0;">Loading notifications...</p>
            </div>
        `;

        const notifList = document.getElementById("notifList");
        const markBtn = document.getElementById("markAllReadBtn");

        const renderNotificationsList = (notifications) => {
            if (!notifications || notifications.length === 0) {
                notifList.innerHTML = `<p class="notif-empty" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; margin: 0;">No new notifications</p>`;
                return;
            }

            if (markBtn) {
                markBtn.style.color = hasUnreadNotifications ? "#64748b" : "#3b82f6";
            }

            notifList.innerHTML = notifications.map(note => {
                const isCancelled = note.type === 'booking_cancelled';
                const title = isCancelled ? 'Booking Cancelled' : 'Booking Confirmed';
                const eventTitle = note.eventName || 'Event';
                const countLabel = `${note.ticketCount || 1} ticket${note.ticketCount === 1 ? '' : 's'}`;
                const dateObj = new Date(note.createdAt);
                const timeLabel = isNaN(dateObj.getTime()) ? "Just now" : dateObj.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

                return `
                    <div class="notif-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; transition: background 0.2s; cursor: pointer; gap: 12px;">
                        <div style="flex-grow: 1; text-align: left;">
                            <p class="notif-item-title" style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: ${isCancelled ? '#ef4444' : '#10b981'};">${title}</p>
                            <p class="notif-item-sub" style="margin: 0 0 4px 0; font-size: 12px; color: #475569; font-weight: 500;">${eventTitle} · ${countLabel}</p>
                            <p class="notif-time" style="margin: 0; font-size: 10px; color: #94a3b8;">${timeLabel}</p>
                        </div>
                    </div>
                `;
            }).join('');
        };

        const loadNotifications = async () => {
            try {
                const res = await fetch("/notifications/list");
                const data = await res.json();
                if (data.success) {
                    hasUnreadNotifications = data.hasUnread;
                    let notifDot = notifBtn.querySelector(".notif-dot");
                    if (data.hasUnread) {
                        if (!notifDot) {
                            notifDot = document.createElement("span");
                            notifDot.className = "notif-dot";
                            notifBtn.appendChild(notifDot);
                        }
                    } else {
                        if (notifDot) notifDot.remove();
                    }
                    renderNotificationsList(data.notifications);
                }
            } catch (err) {
                console.error("Error loading notifications:", err);
            }
        };

        // Load initially on DOM load
        loadNotifications();

        // Refresh periodically (every 10s)
        setInterval(loadNotifications, 10000);

        notifBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("open");
            toggleSidebar(false);
            if (notifDropdown.classList.contains("open")) {
                loadNotifications();
            }
        });

        document.addEventListener("click", (e) => {
            if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDropdown.classList.remove("open");
            }
        });

        // Click handler for Mark all as Read button
        document.addEventListener("click", async (e) => {
            if (e.target && e.target.id === "markAllReadBtn") {
                e.stopPropagation();
                try {
                    const res = await fetch("/notifications/mark-read", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                        hasUnreadNotifications = false;
                        const notifDot = notifBtn.querySelector(".notif-dot");
                        if (notifDot) notifDot.remove();
                        e.target.style.color = "#3b82f6";
                    }
                } catch (err) {
                    console.error("Error marking all read:", err);
                }
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
    const logoutBtns = document.querySelectorAll("#logoutBtn, .dropdown-link.logout");
    if (logoutBtns.length > 0) {
        // Inject styles dynamically so they work on pages without common-nav.css (like admin pages)
        const injectStyles = () => {
            if (document.getElementById("logout-modal-styles")) return;
            const style = document.createElement("style");
            style.id = "logout-modal-styles";
            style.textContent = `
                .logout-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(3px);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.25s ease;
                }
                .logout-modal-overlay.open {
                    opacity: 1;
                    visibility: visible;
                }
                .logout-modal {
                    background: #fff;
                    width: 90%;
                    max-width: 400px;
                    border-radius: 16px;
                    padding: 32px;
                    text-align: center;
                    transform: scale(0.9);
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                    font-family: 'DM Sans', -apple-system, sans-serif;
                }
                .logout-modal-overlay.open .logout-modal {
                    transform: scale(1);
                }
                .logout-modal-icon {
                    width: 56px;
                    height: 56px;
                    background: #fef2f2;
                    color: #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                }
                .logout-modal h3 {
                    font-size: 22px;
                    color: #1e293b;
                    margin-bottom: 8px;
                    font-weight: 700;
                }
                .logout-modal p {
                    font-size: 14px;
                    color: #64748b;
                    margin-bottom: 24px;
                    line-height: 1.5;
                }
                .logout-modal-actions {
                    display: flex;
                    gap: 12px;
                }
                .logout-modal-actions button {
                    flex: 1;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .logout-btn-cancel {
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }
                .logout-btn-cancel:hover {
                    background: #e2e8f0;
                }
                .logout-btn-confirm {
                    background: #ef4444;
                    color: #fff;
                    border: 1px solid #ef4444;
                }
                .logout-btn-confirm:hover {
                    background: #dc2626;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
                }
            `;
            document.head.appendChild(style);
        };

        logoutBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                injectStyles();
                
                // Create modal elements dynamically
                const overlay = document.createElement("div");
                overlay.className = "logout-modal-overlay";
                
                const modal = document.createElement("div");
                modal.className = "logout-modal";
                
                modal.innerHTML = `
                    <div class="logout-modal-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </div>
                    <h3>Are you sure you want to log out?</h3>
                    <p>You will need to sign in again to access your dashboard and manage your bookings.</p>
                    <div class="logout-modal-actions">
                        <button class="logout-btn-cancel">Cancel</button>
                        <button class="logout-btn-confirm">Yes, Log Out</button>
                    </div>
                `;
                
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                
                // Trigger animation
                setTimeout(() => overlay.classList.add("open"), 10);
                
                // Handlers
                const closeModal = () => {
                    overlay.classList.remove("open");
                    setTimeout(() => overlay.remove(), 250); // wait for CSS transition
                };
                
                overlay.querySelector(".logout-btn-cancel").addEventListener("click", closeModal);
                overlay.addEventListener("click", (e) => {
                    if (e.target === overlay) closeModal();
                });
                
                overlay.querySelector(".logout-btn-confirm").addEventListener("click", () => {
                    window.location.href = "/logout";
                });
            });
        });
    }
});
