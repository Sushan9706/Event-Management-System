/* ============================================================
   MANAGE BOOKING — Frontend JavaScript
   Event Management System (EMS)
   ============================================================ */

'use strict';

/* ---------- CANCEL MODAL ---------- */

/**
 * Show the cancel confirmation modal.
 */
function showCancelModal() {
    const modal = document.getElementById('cancelModal');
    if (modal) {
        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
        // Focus the "Keep Booking" button for accessibility
        setTimeout(() => {
            const keepBtn = modal.querySelector('.btn-keep');
            if (keepBtn) keepBtn.focus();
        }, 50);
    }
}

/**
 * Close the cancel modal without taking action.
 */
function closeCancelModal() {
    const modal = document.getElementById('cancelModal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
    }
}

/* ---------- DOWNLOAD MODAL ---------- */

function showDownloadModal() {
    const modal = document.getElementById('downloadModal');
    if (modal) {
        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            const cancelBtn = modal.querySelector('.btn-keep');
            if (cancelBtn) cancelBtn.focus();
        }, 50);
    }
}

function closeDownloadModal() {
    const modal = document.getElementById('downloadModal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
    }
}

function saveTicket() {
    const modal = document.getElementById('downloadModal');
    if (!modal) return;

    const data = modal.dataset || {};
    const lines = [
        'EMS Ticket Confirmation',
        `Event: ${data.event || ''}`,
        `Date: ${data.date || ''}`,
        data.time ? `Time: ${data.time}` : null,
        `Location: ${data.location || ''}`,
        `User ID: ${data.userId || ''}`,
        `Booking Ref: ${data.bookingRef || ''}`,
        `Status: ${(data.status || '').toUpperCase()}`
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const safeRef = (data.bookingRef || 'ticket').replace(/[^a-zA-Z0-9-_\.]/g, '_');
    const fileName = `EMS-${safeRef}.txt`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    closeDownloadModal();
}

/**
 * Confirm cancellation — send POST request to cancel the booking.
 * @param {string} id - The booking MongoDB _id
 */
async function confirmCancel(id) {
    const confirmBtn = document.getElementById('cancelBtnText');
    const btn = confirmBtn ? confirmBtn.closest('button') : null;

    // Show loading state
    if (confirmBtn) confirmBtn.textContent = 'Cancelling...';
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`/bookings/cancel/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeCancelModal();

            // Update the status badge visually
            const badge = document.querySelector('.status-badge');
            if (badge) {
                badge.textContent = 'CANCELLED';
                badge.className = 'status-badge status-cancelled';
            }

            // Remove cancel button and show cancelled notice
            const cancelSection = document.querySelector('.cancel-section');
            if (cancelSection) {
                cancelSection.outerHTML = `
                    <div class="cancelled-notice">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        This booking has been cancelled.
                    </div>`;
            }
        } else {
            // Reset button state
            if (confirmBtn) confirmBtn.textContent = 'Yes, Cancel';
            if (btn) btn.disabled = false;
        }
    } catch (err) {
        console.error('Cancel request failed:', err);

        // Reset button state
        if (confirmBtn) confirmBtn.textContent = 'Yes, Cancel';
        if (btn) btn.disabled = false;
    }
}

/* ---------- KEYBOARD & ACCESSIBILITY ---------- */

document.addEventListener('keydown', function (e) {
    const modal = document.querySelector('.modal-overlay.visible');
    if (modal) {
        // Close modal on Escape key
        if (e.key === 'Escape') {
            if (modal.id === 'cancelModal') {
                closeCancelModal();
            }
            if (modal.id === 'downloadModal') {
                closeDownloadModal();
            }
        }
        // Trap focus inside modal
        if (e.key === 'Tab') {
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
    }
});

// Close modal when clicking the backdrop
document.addEventListener('click', function (e) {
    const modal = document.getElementById('cancelModal');
    if (modal && e.target === modal) {
        closeCancelModal();
    }
});
