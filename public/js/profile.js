"use strict";

const DEFAULT_PROFILE_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23e74c3c'/%3E%3Ccircle cx='80' cy='58' r='28' fill='%23fff'/%3E%3Ccircle cx='80' cy='60' r='24' fill='%232c3e50'/%3E%3Ccircle cx='71' cy='58' r='4' fill='%23fff'/%3E%3Ccircle cx='89' cy='58' r='4' fill='%23fff'/%3E%3Crect x='72' y='64' width='16' height='3' rx='1.5' fill='%23fff' opacity='.5'/%3E%3Cellipse cx='80' cy='118' rx='40' ry='26' fill='%232c3e50'/%3E%3Crect x='75' y='82' width='10' height='18' fill='%23fff'/%3E%3Crect x='68' y='95' width='24' height='3' fill='%23fff'/%3E%3C/svg%3E";

const DEFAULT_NAV_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Crect width='34' height='34' rx='17' fill='%23e74c3c'/%3E%3Ccircle cx='17' cy='13' r='6' fill='%23fff'/%3E%3Cellipse cx='17' cy='27' rx='10' ry='6' fill='%23fff'/%3E%3C/svg%3E";

const saved = {};
let pendingFile = null

function persistState() {
  ["username", "email", "currentPw", "newPw", "confirmPw"].forEach((id) => {
    saved[id] = document.getElementById(id).value;
  });
  saved.profileSrc = document.getElementById("profileAvatar").src;
  saved.navSrc = document.getElementById("navAvatar").src;
}

let toastTimer = null;
function showToast(msg, ms = 2800) {
  clearTimeout(toastTimer);
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

function toggleNotif() {
  document.getElementById("notifPanel").classList.toggle("open");
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Preview the image locally (but don't upload yet)
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById("profileAvatar").src = ev.target.result;
        document.getElementById("navAvatar").src = ev.target.result;
    };
    reader.readAsDataURL(file);

    // 2. Store the file for later
    pendingFile = file;
}

function removePhoto() {
  document.getElementById("profileAvatar").src = DEFAULT_PROFILE_AVATAR;
  document.getElementById("navAvatar").src = DEFAULT_NAV_AVATAR;
  document.getElementById("avatarInput").value = "";
  showToast("Photo removed. Save Changes to confirm.");
}

async function updatePassword() {
  const currentPassword = document.getElementById("currentPw").value.trim();
  const newPassword = document.getElementById("newPw").value.trim();
  const confirmNewPassword = document.getElementById("confirmPw").value.trim();

  // 1. Basic Frontend Validation
  if (!currentPassword) {
    showToast("⚠️ Enter your current password.");
    return;
  }
  if (newPassword.length < 8) {
    showToast("⚠️ New password must be at least 8 characters.");
    return;
  }
  if (newPassword !== confirmNewPassword) {
    showToast("⚠️ New passwords do not match.");
    return;
  }
  if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    showToast("⚠️ Use an uppercase letter, a number, and a symbol.");
    return;
  }

  try {
    // 2. Send data to the server
    const response = await fetch('/profile/update-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmNewPassword
      })
    });

    const result = await response.json();

    if (response.ok) {
      // 3. Success! Clear the fields
      document.getElementById("currentPw").value = "";
      document.getElementById("newPw").value = "";
      document.getElementById("confirmPw").value = "";
      showToast("✅ " + result.message);
      persistState(); // Update the saved state so "Discard" doesn't bring back old text
    } else {
      // 4. Server-side error (e.g., wrong current password)
      showToast("❌ " + (result.message || "Update failed"));
    }
  } catch (err) {
    console.error("Fetch error:", err);
    showToast("❌ Network error. Try again later.");
  }
}

function openDiscardModal() {
  document.getElementById("discardModal").classList.add("open");
}
function closeDiscardModal() {
  document.getElementById("discardModal").classList.remove("open");
}

function confirmDiscard() {
    // Reset inputs to original saved values
    ["username", "email"].forEach((id) => {
        document.getElementById(id).value = saved[id];
    });
    
    // Reset images to original saved paths
    document.getElementById("profileAvatar").src = saved.profileSrc;
    document.getElementById("navAvatar").src = saved.navSrc;
    
    // CRITICAL: Clear the pending upload
    pendingFile = null;
    document.getElementById("avatarInput").value = "";

    closeDiscardModal();
    showToast("Changes discarded.");
}

async function saveChanges() {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!username || !email) {
        return showToast("⚠️ Please fill in all fields.");
    }

    // We use FormData because it can carry both Text and Files
    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    
    if (pendingFile) {
        formData.append("avatar", pendingFile);
    }

    try {
        const response = await fetch('/profile/update-info', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showToast("✅ Changes saved successfully!");
            pendingFile = null; // Clear the pending file
            persistState();
        } else {
            showToast("❌ " + result.message);
        }
    } catch (err) {
        showToast("❌ Failed to save changes.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
  persistState();

  document.addEventListener("click", (e) => {
    const btn = document.getElementById("notifBtn");
    const panel = document.getElementById("notifPanel");
    if (panel && !btn.contains(e.target) && !panel.contains(e.target)) {
      panel.classList.remove("open");
    }
  });

  document
    .getElementById("discardModal")
    .addEventListener("click", function (e) {
      if (e.target === this) closeDiscardModal();
    });
});
