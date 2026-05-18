/**
 * Profile Management Script
 * Handles: Image Preview, Removal (Draft), and Final Save to Server
 */

// 1. STATE VARIABLES (The "Draft" state)
let selectedFile = null;
let isRemovalPending = false;

// Grab elements for frequent use
const profileAvatar = document.getElementById('profileAvatar');
const navAvatar = document.getElementById('navAvatar');
const usernameVal = document.getElementById('username').value;

// Default avatar logic (matching your EJS logic)
const defaultAvatar = `https://ui-avatars.com/api/?name=${usernameVal}&background=e74c3c&color=fff`;

/**
 * 2. PREVIEW LOGIC
 * Triggered when user selects a file from their computer.
 * Does NOT upload to server yet.
 */
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast("Please select an image file", "error");
            return;
        }

        selectedFile = file;
        isRemovalPending = false; // Uploading cancels a pending removal

        // Use FileReader to show a local preview immediately
        const reader = new FileReader();
        reader.onload = function(e) {
            profileAvatar.src = e.target.result;
            if (navAvatar) navAvatar.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

/**
 * 3. REMOVE LOGIC
 * Triggered when user clicks "Remove Photo".
 * Only updates the UI to show the default avatar.
 */
function removePhoto() {
    selectedFile = null;
    isRemovalPending = true;

    // Show the placeholder in the UI
    profileAvatar.src = defaultAvatar;
    if (navAvatar) navAvatar.src = defaultAvatar;
}

/**
 * 4. SAVE LOGIC
 * Triggered when "Save Changes" is clicked.
 * This is the ONLY function that communicates with the database.
 */
async function saveChanges() {
    const formData = new FormData();

    // Determine what to send to the backend
    if (isRemovalPending) {
        // Tell backend to delete the current image path
        formData.append('removeProfileImage', 'true');
    } else if (selectedFile) {
        // Attach the new file. 
        // NOTE: The key 'avatar' must match upload.single('avatar') in your route!
        formData.append('avatar', selectedFile);
    } else {
        showToast("No changes to save.", "info");
        return;
    }

    try {
        const response = await fetch('/profile/update-info', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showToast("Profile updated successfully!");
            // Reload after a short delay so user sees the success toast
            setTimeout(() => {
                window.location.href = window.userRole === 'admin' ? '/admin/dashboard' : '/user';
            }, 1000);
        } else {
            showToast(result.message || "Failed to update profile", "error");
        }
    } catch (err) {
        console.error("Save Error:", err);
        showToast("Server connection failed.", "error");
    }
}

/**
 * 5. DISCARD / MODAL LOGIC
 */
function openDiscardModal() {
    document.getElementById('discardModal').classList.add('open');
}

function closeDiscardModal() {
    document.getElementById('discardModal').classList.remove('open');
}

function confirmDiscard() {
    // 1. Clear password fields
    document.getElementById('currentPw').value = "";
    document.getElementById('newPw').value = "";
    document.getElementById('confirmPw').value = "";

    // 2. Clear any selected file and reset removal pending
    selectedFile = null;
    isRemovalPending = false;

    // 3. Reload the page to reset the avatar and fetch original data
    // (This also closes the modal automatically as state is lost)
    window.location.reload();
}

/**
 * 6. PASSWORD LOGIC (Existing functionality)
 */
async function updatePassword() {
    const currentPassword = document.getElementById('currentPw').value;
    const newPassword = document.getElementById('newPw').value;
    const confirmNewPassword = document.getElementById('confirmPw').value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showToast("Please fill all password fields", "error");
        return;
    }

    // Password Validation
    if (/\s/.test(newPassword)) {
        showToast("Spaces are not allowed in the password", "error");
        return;
    }

    if (newPassword.length < 8) {
        showToast("Password must be at least 8 characters long", "error");
        return;
    }

    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasNumber) {
        showToast("Password must include at least one number", "error");
        return;
    }

    if (!hasSymbol) {
        showToast("Password must include at least one unique symbol", "error");
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showToast("New passwords do not match", "error");
        return;
    }

    try {
        const response = await fetch('/profile/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
        });

        const result = await response.json();
        if (response.ok) {
            document.getElementById('confirmPw').value = "";
            
            showToast("Redirecting to dashboard...");
            setTimeout(() => {
                window.location.href = window.userRole === 'admin' ? '/admin/dashboard' : '/user';
            }, 1000);
        } else {
            showToast(result.message, "error");
        }
    } catch (err) {
        showToast("Error updating password", "error");
    }
}

/**
 * 7. UTILS
 */
function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.backgroundColor = type === "error" ? "#e74c3c" : "#2ecc71";
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Notification Toggle
function toggleNotif() {
    const panel = document.getElementById('notifPanel');
    if(panel) panel.classList.toggle('open');
}

// Password Visibility Toggle
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.classList.add('active');
    } else {
        input.type = 'password';
        btn.classList.remove('active');
    }
}