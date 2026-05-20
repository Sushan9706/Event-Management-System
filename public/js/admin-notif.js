document.addEventListener("DOMContentLoaded", () => {
    const userTrigger = document.getElementById('userTrigger');
    const userDropdown = document.getElementById('userDropdown');
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifDot = document.getElementById('notifDot');

    let burger = null;
    let mobileMenu = null;

    // Store unread status globally in this script
    let hasUnreadNotifications = false;

    if (userTrigger) {
        userTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userDropdown) {
                userDropdown.classList.toggle('show');
            }
            if (notifDropdown) {
                notifDropdown.style.display = 'none';
                notifDropdown.classList.remove('show');
                notifDropdown.classList.remove('open');
            }
        });
    }

    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mobileMenu && burger) {
                mobileMenu.classList.remove('active');
                burger.classList.remove('open');
            }
            if (notifDropdown) {
                const isHidden = notifDropdown.style.display === 'none' || notifDropdown.style.display === '';
                notifDropdown.style.display = isHidden ? 'block' : 'none';
                notifDropdown.classList.toggle('show', isHidden);
                notifDropdown.classList.toggle('open', isHidden);
                if (isHidden) {
                    fetchNotifications();
                }
            }
            if (userDropdown) {
                userDropdown.classList.remove('show');
            }
        });
    }

    if (notifDropdown) {
        notifDropdown.addEventListener('click', async (e) => {
            if (e.target && e.target.id === 'adminMarkAllReadBtn') {
                e.stopPropagation();
                try {
                    const res = await fetch('/admin/notifications/mark-read', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        hasUnreadNotifications = false;
                        if (notifDot) notifDot.style.display = 'none';
                        e.target.style.color = '#3b82f6';
                    }
                } catch (err) {
                    console.error('Error marking all read:', err);
                }
            } else {
                e.stopPropagation();
            }
        });
    }

    document.addEventListener('click', () => {
        if (userDropdown) userDropdown.classList.remove('show');
        if (notifDropdown) {
            notifDropdown.style.display = 'none';
            notifDropdown.classList.remove('show');
            notifDropdown.classList.remove('open');
        }
    });

    async function fetchNotifications() {
        try {
            const response = await fetch('/admin/notifications');
            const data = await response.json();
            
            hasUnreadNotifications = data.hasUnread;
            if (hasUnreadNotifications) {
                if (notifDot) notifDot.style.display = 'block';
            } else {
                if (notifDot) notifDot.style.display = 'none';
            }

            renderNotifications(data.notifications);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            const listEl = notifDropdown ? notifDropdown.querySelector('#notifList') : null;
            if (listEl) listEl.innerHTML = '<p class="notif-empty">Failed to load</p>';
        }
    }

    function renderNotifications(notifications) {
        if (!notifDropdown) return;
        
        const btnColor = hasUnreadNotifications ? '#64748b' : '#3b82f6';

        notifDropdown.innerHTML = `
            <div class="notif-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-top-left-radius: 12px; border-top-right-radius: 12px;">
                <span class="notif-title" style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #64748b; text-transform: uppercase;">Recent Bookings</span>
                <button id="adminMarkAllReadBtn" class="mark-all-read-btn" style="background: none; border: none; font-size: 11px; font-weight: 600; color: ${btnColor}; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: all 0.2s;">Mark all as Read</button>
            </div>
            <div id="notifList" style="max-height: 320px; overflow-y: auto;">
                <!-- Rendered items -->
            </div>
        `;

        const listEl = notifDropdown.querySelector('#notifList');

        if (!notifications || notifications.length === 0) {
            if (listEl) listEl.innerHTML = '<p class="notif-empty" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; margin: 0;">No recent bookings</p>';
            return;
        }

        if (listEl) {
            listEl.innerHTML = notifications.map(n => {
                const date = new Date(n.createdAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                let title = `New Booking: ${n.userName}`;
                let sub = `${n.name} · ${n.countLabel}`;
                let clickAction = '';

                if (n.type === 'contact') {
                    title = `New Message: ${n.userName}`;
                    sub = `Subject: ${n.name} · "${n.countLabel}"`;
                    clickAction = `onclick="window.location.href='/admin/messages'"`;
                } else if (n.type === 'venue') {
                    clickAction = `onclick="window.location.href='/admin/venues'"`;
                } else {
                    clickAction = `onclick="window.location.href='/admin/dashboard'"`;
                }

                return `
                    <div class="notif-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; gap: 12px; cursor: pointer;" ${clickAction}>
                        <div style="flex-grow: 1; text-align: left;">
                            <p class="notif-item-title" style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: #1e293b;">${title}</p>
                            <p class="notif-item-sub" style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 500;">${sub}</p>
                            <p class="notif-time" style="margin: 0; font-size: 10px; color: #94a3b8;">${date}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Initial call to check for unread notifications on load
    fetchNotifications();

    // ── Hamburger Toggle for Admin mobile navigation ──
    const navInner = document.querySelector('.nav-inner');
    const navLinks = document.querySelector('.nav-links');
    if (navInner && navLinks) {
        // Create styles
        const style = document.createElement('style');
        style.id = 'admin-hamburger-styles';
        style.textContent = `
            .hamburger-btn {
                display: none;
                background: none;
                border: 1px solid var(--border-soft, #e2e8f0);
                color: var(--text-rich, #0f172a);
                cursor: pointer;
                width: 38px;
                height: 38px;
                border-radius: 10px;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                order: 3;
                margin-left: 12px;
            }
            .hamburger-btn:hover {
                background: #f8fafc;
                border-color: var(--accent-indigo, #4f46e5);
            }
            .admin-mobile-menu {
                display: none;
            }
            @media (max-width: 768px) {
                .hamburger-btn {
                    display: flex;
                }
                .nav-inner {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                }
                .nav-brand {
                    order: 1;
                }
                .nav-links {
                    order: 2;
                    margin-left: auto;
                    display: flex !important;
                    align-items: center !important;
                    gap: 12px !important;
                }
                .nav-links > .nav-link {
                    display: none !important;
                }
                .user-menu-container {
                    display: none !important;
                }
                .admin-mobile-menu {
                    display: flex;
                    flex-direction: column;
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    background: #ffffff;
                    border-bottom: 1.5px solid var(--border-soft, #e2e8f0);
                    padding: 16px 24px 24px;
                    box-shadow: 0 15px 30px -5px rgba(15, 23, 42, 0.08);
                    z-index: 999;
                    transform: translateY(-20px);
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .admin-mobile-menu.active {
                    transform: translateY(0);
                    opacity: 1;
                    visibility: visible;
                }
                .admin-mobile-menu .nav-link {
                    font-size: 15px !important;
                    font-weight: 600 !important;
                    color: var(--text-rich, #0f172a) !important;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--border-soft, #f1f5f9);
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .admin-mobile-menu .nav-link:hover {
                    color: var(--accent-indigo, #4f46e5) !important;
                }
                .admin-mobile-menu .nav-link:last-child {
                    border-bottom: none;
                }
            }
        `;
        document.head.appendChild(style);

        // Create the mobile menu drawer container
        mobileMenu = document.createElement('div');
        mobileMenu.className = 'admin-mobile-menu';
        
        // Clone page navigation links
        const links = navLinks.querySelectorAll('.nav-link');
        links.forEach(link => {
            const clone = link.cloneNode(true);
            clone.classList.remove('active');
            mobileMenu.appendChild(clone);
        });

        // Add Profile & Logout directly to mobile menu for clean mobile UX
        const profileLink = document.createElement('a');
        profileLink.href = '/profile';
        profileLink.className = 'nav-link mobile-only-link';
        profileLink.textContent = 'Account Settings';
        
        const logoutLink = document.createElement('a');
        logoutLink.href = '/logout';
        logoutLink.className = 'nav-link mobile-only-link logout-trigger-mobile';
        logoutLink.textContent = 'Logout';
        logoutLink.style.color = '#ef4444';
        
        mobileMenu.appendChild(profileLink);
        mobileMenu.appendChild(logoutLink);

        // Create hamburger button
        burger = document.createElement('button');
        burger.className = 'hamburger-btn';
        burger.setAttribute('aria-label', 'Toggle navigation');
        burger.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" class="line-1"></line>
                <line x1="3" y1="6" x2="21" y2="6" class="line-2"></line>
                <line x1="3" y1="18" x2="21" y2="18" class="line-3"></line>
            </svg>
        `;
        
        // Append burger button next to notifications in nav-inner
        navInner.appendChild(burger);
        document.body.appendChild(mobileMenu);

        // Toggle state
        burger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notifDropdown) {
                notifDropdown.style.display = 'none';
                notifDropdown.classList.remove('show');
                notifDropdown.classList.remove('open');
            }
            burger.classList.toggle('open');
            mobileMenu.classList.toggle('active');
        });

        // Close on tap outside
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !burger.contains(e.target)) {
                burger.classList.remove('open');
                mobileMenu.classList.remove('active');
            }
        });

        // Re-use current logout modal for the mobile logout link
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            burger.classList.remove('open');
            mobileMenu.classList.remove('active');
            
            // Check if standard logout modal is loaded
            const standardLogout = document.querySelector('.dropdown-link.logout');
            if (standardLogout) {
                standardLogout.click();
            } else {
                window.location.href = '/logout';
            }
        });
    }
});
