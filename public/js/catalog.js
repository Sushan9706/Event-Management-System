const searchOverlay = document.getElementById("searchOverlay");
const searchInput = document.getElementById("searchInput");

document.getElementById("searchBtn").addEventListener("click", () => {
  searchOverlay.classList.toggle("open");
  if (searchOverlay.classList.contains("open")) {
    searchInput.focus();
  }
});

searchOverlay.addEventListener("click", (e) => {
  if (e.target === searchOverlay) searchOverlay.classList.remove("open");
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleHeroSearch(searchInput.value);
    searchOverlay.classList.remove("open");
  }
});

document.getElementById("findBtn").addEventListener("click", () => {
  const val = document.getElementById("heroSearch").value;
  handleHeroSearch(val);
});

document.getElementById("heroSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleHeroSearch(e.target.value);
  }
});

function handleHeroSearch(value) {
  const val = value.trim().toLowerCase();
  const cards = document.querySelectorAll(".event-card");

  cards.forEach((card) => {
    const name = card.querySelector(".card-name").textContent.toLowerCase();
    const location = card
      .querySelectorAll(".card-meta-row")[1]
      .textContent.toLowerCase();

    if (!val || name.includes(val) || location.includes(val)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });

  document.querySelector(".events-section").scrollIntoView({
    behavior: "smooth",
  });
}

const notifDropdown = document.getElementById("notifDropdown");

document.getElementById("notifBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  notifDropdown.classList.toggle("open");
});

document.addEventListener("click", () => {
  notifDropdown.classList.remove("open");
});

const avatarSidebar = document.getElementById("avatarSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openSidebar() {
  avatarSidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
}

function closeSidebar() {
  avatarSidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
}

document.getElementById("avatarBtn").addEventListener("click", () => {
  avatarSidebar.classList.contains("open") ? closeSidebar() : openSidebar();
});

sidebarOverlay.addEventListener("click", closeSidebar);

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (confirm("Are you sure you want to log out?")) {
    window.location.href = "/";
  }
});

document.getElementById("filters").addEventListener("click", (e) => {
  if (!e.target.classList.contains("filter-tag")) return;

  document
    .querySelectorAll(".filter-tag")
    .forEach((t) => t.classList.remove("active"));

  e.target.classList.add("active");

  const filter = e.target.dataset.filter;

  document.querySelectorAll(".event-card").forEach((card) => {
    const match = filter === "all" || card.dataset.category === filter;

    card.style.display = match ? "block" : "none";
  });
});

document.getElementById("loadMoreBtn").addEventListener("click", () => {
  document.querySelectorAll(".event-card.hidden").forEach((c) => {
    c.classList.remove("hidden");
  });

  document.getElementById("loadMoreBtn").style.display = "none";

  window.scrollBy({
    top: 300,
    behavior: "smooth",
  });
});

let currentCard = null;

function openModal(btn) {
  currentCard = btn.closest(".event-card");

  const name = currentCard.querySelector(".card-name").textContent;
  const tag = currentCard.querySelector(".card-tag").textContent;
  const tagClass = currentCard.querySelector(".card-tag").className;
  const rows = currentCard.querySelectorAll(".card-meta-row");
  const date = rows[0].textContent.trim();
  const location = rows[1].textContent.trim();
  const price = currentCard.querySelector(".card-price").textContent;
  const isFree = currentCard
    .querySelector(".card-price")
    .classList.contains("free");

  document.getElementById("modalTag").textContent = tag;
  document.getElementById("modalTag").className =
    "modal-tag " + tagClass.replace("card-tag ", "");
  document.getElementById("modalName").textContent = name;
  document.getElementById("modalDate").textContent = date;
  document.getElementById("modalLocation").textContent = location;
  document.getElementById("modalPrice").textContent = price;
  document.getElementById("modalPrice").className = isFree
    ? "modal-price free"
    : "modal-price";

  document.getElementById("eventModal").classList.add("open");
}

function closeModal() {
  document.getElementById("eventModal").classList.remove("open");
  currentCard = null;
}

document.getElementById("eventModal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

function confirmBooking() {
  if (!currentCard) return;

  const name = currentCard.querySelector(".card-name").textContent;
  const rows = currentCard.querySelectorAll(".card-meta-row");
  const date = rows[0].textContent.trim();
  const location = rows[1].textContent.trim();

  document.getElementById("bookingEventName").textContent = name;
  document.getElementById("bookingDetail").textContent =
    date + " · " + location;

  closeModal();
  document.getElementById("bookingModal").classList.add("open");
}

function closeBooking() {
  document.getElementById("bookingModal").classList.remove("open");
  window.location.href = "/user";
}

document.getElementById("bookingModal").addEventListener("click", function (e) {
  if (e.target === this) this.classList.remove("open");
});

document.querySelectorAll(".event-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-details")) {
      openModal(card.querySelector(".btn-details"));
    }
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchOverlay.classList.remove("open");
    notifDropdown.classList.remove("open");
    closeModal();
    closeSidebar();
  }
});
