// core.js — UI logic, menus, profile, settings, home search, categories

// Simple helper
const $ = id => document.getElementById(id);

// Shared localStorage keys
const LS = {
    searchMode: "searchMode",          // "location" | "city"
    sortOption: "sortOption",          // "distance" | "rating" | "alpha"
    minRating: "minRating",
    wheelchairOnly: "wheelchairOnly",
    searchDistance: "searchDistance",  // distance in km
    recentList: "recentHobbies",
    profile: "userProfile"
};

/* ============================
   SETTINGS HELPERS
============================ */
function restoreSettingsToDOM() {
    if ($("searchMode"))      $("searchMode").value = localStorage.getItem(LS.searchMode) || "location";
    if ($("sortOption"))      $("sortOption").value = localStorage.getItem(LS.sortOption) || "distance";
    if ($("minRating"))       $("minRating").value = localStorage.getItem(LS.minRating) || "0";
    if ($("searchDistance"))  $("searchDistance").value = localStorage.getItem(LS.searchDistance) || "5";
    if ($("wheelchairOnly"))  $("wheelchairOnly").checked = localStorage.getItem(LS.wheelchairOnly) === "true";
}

function persistSettingsFromDOM() {
    if ($("searchMode"))     localStorage.setItem(LS.searchMode, $("searchMode").value);
    if ($("sortOption"))     localStorage.setItem(LS.sortOption, $("sortOption").value);
    if ($("minRating"))      localStorage.setItem(LS.minRating, $("minRating").value);
    if ($("searchDistance")) localStorage.setItem(LS.searchDistance, $("searchDistance").value);
    if ($("wheelchairOnly")) localStorage.setItem(LS.wheelchairOnly, $("wheelchairOnly").checked ? "true" : "false");
}

/* ============================
   UTILS (UI side)
============================ */
function safeText(s) {
    return s == null ? "" : String(s);
}

async function loadProfileModal() {
    const container = document.createElement("div");
    const modalHtml = await fetch("/pages/profile.html").then(r => r.text());
    container.innerHTML = modalHtml;
    document.body.appendChild(container.firstElementChild);

    // After inserting modal → re-initialize handlers
    initProfileUI();
}


/* ============================
   CATEGORY CLICK → RESULTS
============================ */
function openCategoryAndSearch(term) {
    // Save recent list
    let rec = JSON.parse(localStorage.getItem(LS.recentList) || "[]");
    rec = rec.filter(x => x !== term);
    rec.unshift(term);
    localStorage.setItem(LS.recentList, JSON.stringify(rec.slice(0, 30)));

    window.location.href = `results.html?query=${encodeURIComponent(term)}`;
}

/* ============================
   HOME: POPULAR HOBBIES CAROUSEL
============================ */
function buildRandomHobbies(containerId = "randomHobbyCarousel") {
    const container = $(containerId);
    if (!container) return;

    const now = Date.now();
    const saved = JSON.parse(localStorage.getItem("randomHobbiesCache") || "{}");

    // If cache exists and < 10 minutes old → use it
    if (saved.hobbies && saved.timestamp && now - saved.timestamp < 600000) {
        renderRandomHobbies(saved.hobbies, container);
        return;
    }

    // Otherwise, generate new 3 picks
    const all = getAllHobbies();
    const pool = [...all];
    const picks = [];

    while (picks.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
    }

    // Save for 1 hour
    localStorage.setItem("randomHobbiesCache", JSON.stringify({
        hobbies: picks,
        timestamp: now
    }));

    renderRandomHobbies(picks, container);
}

// Picked-up image path helper
function hobbyImage(name) {
    const safe = encodeURIComponent(name);
    return `/images/hobbies/${safe}.jpg`;
}

// Check if image exists (cached result so we don't hammer filesystem)
const imageCache = {};

function resolveHobbyImage(name) {
    return new Promise(resolve => {
        const url = hobbyImage(name);

        // If checked before, return cached
        if (imageCache[url] !== undefined) {
            resolve(imageCache[url]);
            return;
        }

        const img = new Image();
        img.onload = () => { imageCache[url] = url; resolve(url); };
        img.onerror = () => { imageCache[url] = "/img/default.jpg"; resolve("/img/default.jpg"); };

        img.src = url;
    });
}


function renderRandomHobbies(picks, container) {
    container.innerHTML = "";

    picks.forEach(name => {
        const card = document.createElement("div");
        card.className = "carousel-card";
        card.style.minWidth = "100px";
        card.textContent = name;
        card.addEventListener("click", () => openCategoryAndSearch(name));
        container.appendChild(card);
    });
}


function buildAllHobbiesCarousel(containerId = "allHobbiesCarousel") {
    const container = $(containerId);
    if (!container) return;

    const hobbies = getAllHobbies();
    container.innerHTML = "";

    hobbies.forEach(name => {
        const card = document.createElement("button");
        card.className = "carousel-card";
        card.textContent = name;
        card.addEventListener("click", () => openCategoryAndSearch(name));
        container.appendChild(card);
    });
}



function getAllHobbies() {
    const defaults = [
        "Art","Baking","Badminton","Chess",
        "Climbing","Cooking","Cycling",
        "Dancing","Fishing","Football",
        "Gardening","Guitar","Knitting",
        "Piano","Photography","Pottery",
        "Swimming","Table Tennis","Traveling",
        "Volleyball","Woodworking","Yoga"
    ];

    const custom = JSON.parse(localStorage.getItem("customHobbies") || "[]");

    return [...defaults, ...custom]; // no duplicates
}

function addCustomHobby(name) {
    let custom = JSON.parse(localStorage.getItem("customHobbies") || "[]");
    if (!custom.includes(name)) {
        custom.push(name);
        localStorage.setItem("customHobbies", JSON.stringify(custom));
    }
}


/* ============================
   HOME: RECENTLY VIEWED
============================ */
function renderRecents(containerId = "recentList") {
    const container = $(containerId);
    if (!container) return;

    const rec = JSON.parse(localStorage.getItem(LS.recentList) || "[]");

    if (!rec.length) {
        container.innerHTML = `<p class="muted">No recent searches yet — try tapping a category!</p>`;
        return;
    }

    //Only shows the 4 most recent.
    container.innerHTML = "";
    rec.slice(0, 4).forEach(term => {
        const b = document.createElement("button");
        b.className = "recent-item";
        b.textContent = term;
        b.addEventListener("click", () => openCategoryAndSearch(term));
        container.appendChild(b);
    });
}

/* ============================
   PROFILE MODAL + AVATAR
============================ */
function initProfileUI() {
    const avatar = $("profileAvatar");
    if (!avatar) return;

    const modal     = $("profileModal");
    const closeBtn  = $("closeProfile");
    const cancelBtn = $("cancelProfile");
    const saveBtn   = $("saveProfile");
    const fileInput = $("profileImageInput");
    const preview   = $("profilePreview");
    const nameInput = $("profileName");
    const emailInput= $("profileEmail");

    // Load saved profile
    const saved = JSON.parse(localStorage.getItem(LS.profile) || "{}");
    avatar.src    = saved.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'/%3E";
    if (preview)   preview.src   = saved.avatar || avatar.src;
    if (nameInput) nameInput.value = saved.name || "";
    if (emailInput)emailInput.value = saved.email || "";

    avatar.addEventListener("click", () => modal && modal.classList.remove("hidden"));
    closeBtn && closeBtn.addEventListener("click", () => modal && modal.classList.add("hidden"));
    cancelBtn && cancelBtn.addEventListener("click", () => modal && modal.classList.add("hidden"));

    fileInput && fileInput.addEventListener("change", e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (preview) preview.src = reader.result;
            avatar.src = reader.result;
        };
        reader.readAsDataURL(f);
    });

    saveBtn && saveBtn.addEventListener("click", () => {
        const profile = {
            name:  nameInput?.value  || "",
            email: emailInput?.value || "",
            avatar: preview?.src     || avatar.src
        };
        localStorage.setItem(LS.profile, JSON.stringify(profile));
        modal && modal.classList.add("hidden");

        document.querySelectorAll(".profile-pic").forEach(img => img.src = profile.avatar);
    });
}

/* ============================
   SIDE MENU (HAMBURGER)
============================ */
function initSideMenu() {
    const hamMenu       = document.querySelector(".ham-menu");
    const offScreenMenu = document.querySelector(".off-screen-menu");
    if (!hamMenu || !offScreenMenu) return;

    hamMenu.addEventListener("click", () => {
        hamMenu.classList.toggle("active");
        offScreenMenu.classList.toggle("active");
    });
}

/* ============================
   GLOBAL SEARCH BAR (HOME)
   (Results page has its own handler in search.js)
============================ */
function initGlobalSearchBar() {
    const input = $("searchInput");
    const btn   = $("searchBtn");

    if (!input || !btn) return;

    // If we're on the home page (no #results), let this search behave like a category
    const isHome = !$("results");

    if (!isHome) return; // results page handler lives in search.js

    btn.addEventListener("click", () => {
        const term = input.value.trim();
        if (!term) return;
        openCategoryAndSearch(term);
    });

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") btn.click();
    });
}

/* ============================
   DISTANCE SLIDER (SETTINGS)
============================ */
function initDistanceSlider() {
    const slider      = $("searchDistance");
    const label       = $("distanceLabel");
    const distanceRow = $("distance-row");

    if (!slider || !label) return;

    const savedDistance = localStorage.getItem(LS.searchDistance) || "5";
    slider.value = savedDistance;
    label.textContent = savedDistance + " km";

    // Only update the label live — do NOT save yet.
    slider.addEventListener("input", () => {
        label.textContent = slider.value + " km";
        // actual saving happens when the user clicks "Save settings"
    });

    function updateDistanceVisibility() {
        const modeSel = $("searchMode");
        if (!modeSel || !distanceRow) return;
        distanceRow.style.display = (modeSel.value === "location") ? "flex" : "none";
    }

    // Just change visibility, don't save here
    $("searchMode") && $("searchMode").addEventListener("change", () => {
        updateDistanceVisibility();
    });

    updateDistanceVisibility();
}


/* ============================
   SETTINGS: CITY ROW SHOW/HIDE
============================ */
function initSettingsPageModeToggle() {
    if (!$("searchMode")) return;

    const modeSel = $("searchMode");
    const cityRow = $("city-row");

    const updateCityRow = () => {
        if (!cityRow) return;
        cityRow.style.display = (modeSel.value === "city") ? "block" : "none";
    };

    modeSel.addEventListener("change", () => {
        updateCityRow();
    });

    updateCityRow();
}

/* ============================
   DOMContentLoaded ENTRY
============================ */
document.addEventListener("DOMContentLoaded", () => {
    restoreSettingsToDOM();

    initSideMenu();
    initProfileUI();
    initGlobalSearchBar();
    initDistanceSlider();
    initSettingsPageModeToggle();
    loadProfileModal();

    // Home page
    // Home page
    if ($("randomHobbyCarousel")) {
        buildRandomHobbies();
    }

    if ($("allHobbiesCarousel")) {
        buildAllHobbiesCarousel();
    }

    if ($("recentList")) {
        renderRecents();
}

    // Settings save button
    const saveSettingsBtn = $("saveSettingsBtn");
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", () => {
            persistSettingsFromDOM();
            // Optional small feedback, you can style a toast instead of alert:
            // alert("Settings saved");
        });
    }
});
