document.addEventListener("DOMContentLoaded", () => {
    const userTrigger = document.getElementById('userTrigger');
    const userDropdown = document.getElementById('userDropdown');
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifDot = document.getElementById('notifDot');

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

                return `
                    <div class="notif-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; gap: 12px;">
                        <div style="flex-grow: 1; text-align: left;">
                            <p class="notif-item-title" style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: #1e293b;">New Booking: ${n.userName}</p>
                            <p class="notif-item-sub" style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 500;">${n.name} · ${n.countLabel}</p>
                            <p class="notif-time" style="margin: 0; font-size: 10px; color: #94a3b8;">${date}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Initial call to check for unread notifications on load
    fetchNotifications();
});
