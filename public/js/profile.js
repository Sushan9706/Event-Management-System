"use strict";

const DEFAULT_PROFILE_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23e74c3c'/%3E%3Ccircle cx='80' cy='58' r='28' fill='%23fff'/%3E%3Ccircle cx='80' cy='60' r='24' fill='%232c3e50'/%3E%3Ccircle cx='71' cy='58' r='4' fill='%23fff'/%3E%3Ccircle cx='89' cy='58' r='4' fill='%23fff'/%3E%3Crect x='72' y='64' width='16' height='3' rx='1.5' fill='%23fff' opacity='.5'/%3E%3Cellipse cx='80' cy='118' rx='40' ry='26' fill='%232c3e50'/%3E%3Crect x='75' y='82' width='10' height='18' fill='%23fff'/%3E%3Crect x='68' y='95' width='24' height='3' fill='%23fff'/%3E%3C/svg%3E";

const DEFAULT_NAV_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Crect width='34' height='34' rx='17' fill='%23e74c3c'/%3E%3Ccircle cx='17' cy='13' r='6' fill='%23fff'/%3E%3Cellipse cx='17' cy='27' rx='10' ry='6' fill='%23fff'/%3E%3C/svg%3E";

const saved = {};

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
  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = ev.target.result;
    document.getElementById("profileAvatar").src = src;
    document.getElementById("navAvatar").src = src;
    showToast("Avatar uploaded! Save Changes to keep it.");
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  document.getElementById("profileAvatar").src = DEFAULT_PROFILE_AVATAR;
  document.getElementById("navAvatar").src = DEFAULT_NAV_AVATAR;
  document.getElementById("avatarInput").value = "";
  showToast("Photo removed. Save Changes to confirm.");
}

function updatePassword() {
  const cur = document.getElementById("currentPw").value.trim();
  const nw = document.getElementById("newPw").value.trim();
  const cf = document.getElementById("confirmPw").value.trim();

  if (!cur) {
    showToast("⚠️ Enter your current password.");
    return;
  }
  if (!nw) {
    showToast("⚠️ Enter a new password.");
    return;
  }
  if (nw.length < 8) {
    showToast("⚠️ Password must be at least 8 characters.");
    return;
  }
  if (nw !== cf) {
    showToast("⚠️ New passwords do not match.");
    return;
  }
  if (!/[A-Z]/.test(nw) || !/\d/.test(nw) || !/[^A-Za-z0-9]/.test(nw)) {
    showToast("⚠️ Include an uppercase letter, a number, and a symbol.");
    return;
  }

  document.getElementById("currentPw").value = nw;
  document.getElementById("newPw").value = "";
  document.getElementById("confirmPw").value = "";
  showToast(" Password updated successfully!");
}

function openDiscardModal() {
  document.getElementById("discardModal").classList.add("open");
}
function closeDiscardModal() {
  document.getElementById("discardModal").classList.remove("open");
}

function confirmDiscard() {
  ["username", "email", "currentPw", "newPw", "confirmPw"].forEach((id) => {
    document.getElementById(id).value = saved[id];
  });
  document.getElementById("profileAvatar").src = saved.profileSrc;
  document.getElementById("navAvatar").src = saved.navSrc;
  closeDiscardModal();
  showToast("Changes discarded.");
}

function saveChanges() {
  const user = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  if (!user) {
    showToast("⚠️ Username cannot be empty.");
    return;
  }
  if (!email || !email.includes("@")) {
    showToast("⚠️ Enter a valid email address.");
    return;
  }
  persistState();
  showToast("Changes saved successfully!");
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
