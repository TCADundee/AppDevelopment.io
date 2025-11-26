// core.js — UI logic, menus, profile, settings, home search, categories

// Simple helper
const $ = id => document.getElementById(id);

// Shared localStorage keys
const LS = {
    searchMode: "searchMode",         // "location" | "city"
    sortOption: "sortOption",         // "distance" | "rating" | "alpha"
    minRating: "minRating",
    wheelchairOnly: "wheelchairOnly",
    searchDistance: "searchDistance", // distance in km
    recentList: "recentHobbies",
    profile: "userProfile"
};

// ---------- per-user localStorage helpers ----------

// Key under which we store the current logged-in user's UID
const HF_USER_ID_KEY = "hf_user_id";

// Who is the "current user" for this device?
function getCurrentUserId() {
    // If logged in, this should be the Firebase UID; otherwise we treat them as "guest"
    return localStorage.getItem(HF_USER_ID_KEY) || "guest";
}

// Build a namespaced key like "UID:searchMode" or "guest:recentHobbies"
function userKey(base) {
    return `${getCurrentUserId()}:${base}`;
}

// Read a value for this user; if nothing stored yet, return fallback
function lsGet(base, fallback = null) {
    const v = localStorage.getItem(userKey(base));
    return v === null ? fallback : v;
}

// Write a value for this user
function lsSet(base, value) {
    localStorage.setItem(userKey(base), value);
}


/* ============================
    SETTINGS HELPERS
============================ */
function restoreSettingsToDOM() {
    if ($("searchMode"))       $("searchMode").value       = lsGet(LS.searchMode, "location");
    if ($("sortOption"))       $("sortOption").value       = lsGet(LS.sortOption, "distance");
    if ($("minRating"))        $("minRating").value        = lsGet(LS.minRating, "0");
    if ($("searchDistance"))   $("searchDistance").value   = lsGet(LS.searchDistance, "5");
    if ($("wheelchairOnly"))   $("wheelchairOnly").checked = lsGet(LS.wheelchairOnly, "false") === "true";
}

function persistSettingsFromDOM() {
    if ($("searchMode"))    lsSet(LS.searchMode, $("searchMode").value);
    if ($("sortOption"))    lsSet(LS.sortOption, $("sortOption").value);
    if ($("minRating"))      lsSet(LS.minRating, $("minRating").value);
    if ($("searchDistance")) lsSet(LS.searchDistance, $("searchDistance").value);
    if ($("wheelchairOnly")) lsSet(LS.wheelchairOnly, $("wheelchairOnly").checked ? "true" : "false");
}


/* ============================
    UTILS (UI side)
============================ */
function safeText(s) {
    return s == null ? "" : String(s);
}

async function loadProfileModal() {
    const container = document.createElement("div");
    const modalHtml = await fetch("profile.html").then(r => r.text());
    container.innerHTML = modalHtml;
    document.body.appendChild(container.firstElementChild);

    // After inserting modal → re-initialize handlers
    initProfileUI();
}


/* ============================
    CATEGORY CLICK → RESULTS
============================ */
function openCategoryAndSearch(term) {
    // Save recent *for this user*
    let rec = JSON.parse(lsGet(LS.recentList, "[]"));
    rec = rec.filter(x => x !== term);
    rec.unshift(term);
    lsSet(LS.recentList, JSON.stringify(rec.slice(0, 30)));

    // Navigate to results with term
    window.location.href = `results.html?query=${"places+with+" + encodeURIComponent(term) + "+activities"}`;
}


// Picked-up image path helper
function hobbyImage(name) {
    const safe = encodeURIComponent(name);
    return `img/${safe}.png`;
}

// Check if image exists (used for fallback logic)
function resolveHobbyImage(name) {
    return new Promise(resolve => {
        const url = hobbyImage(name); 

        const img = new Image();
        img.onload = () => {
            resolve(url); 
        };
        img.onerror = () => {
            // Fallback path if the specific image fails to load
            resolve("/img/default.jpg");
        };

        img.src = url; 
    });
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

// Function to render hobby cards with images (Uses Promise.all to ensure images are ready)
function renderRandomHobbies(picks, container) {
    container.innerHTML = ""; // Clear the container

    // 1. Map all hobby names to their image resolution Promises
    const imagePromises = picks.map(name => resolveHobbyImage(name));

    // 2. Wait for ALL promises to resolve
    Promise.all(imagePromises).then(imageUrls => {
        
        // Build the cards only after all image URLs are ready
        picks.forEach((name, index) => {
            const imageUrl = imageUrls[index]; // Get the corresponding URL

            const card = document.createElement("div");
            card.className = "carousel-card";
            card.style.minWidth = "100px";

            // Add the image 
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = name;
            img.className = "hobby-image";
            card.appendChild(img);

            // Add the hobby name text
            const hobbyName = document.createElement("div");
            hobbyName.className = "hobby-name";
            hobbyName.textContent = name;
            card.appendChild(hobbyName);

            // Add event listener for card click
            card.addEventListener("click", () => openCategoryAndSearch(name));
            
            // Append the fully-built card to the container
            container.appendChild(card);
        });
    });
}

// Renders the all hobbies cards with images
function buildAllHobbiesCarousel(containerId = "allHobbiesCarousel") {
    const container = $(containerId);
    if (!container) return;

    const hobbies = getAllHobbies();
    container.innerHTML = "";

    // 1. Map all hobby names to their image resolution Promises
    const imagePromises = hobbies.map(name => resolveHobbyImage(name));

    // 2. Wait for ALL promises to resolve
    Promise.all(imagePromises).then(imageUrls => {
        
        // Build the cards only after all image URLs are ready
        hobbies.forEach((name, index) => {
            const imageUrl = imageUrls[index];

            const card = document.createElement("button");
            card.className = "carousel-card";

            // Add image
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = name;
            img.className = "hobby-image";
            card.appendChild(img);

            // Add hobby name
            const hobbyName = document.createElement("div");
            hobbyName.className = "hobby-name";
            hobbyName.textContent = name;
            card.appendChild(hobbyName);

            // Add event listener to navigate to the results page
            card.addEventListener("click", () => openCategoryAndSearch(name));
            container.appendChild(card);
        });
    });
}


function getAllHobbies() {
    const defaults = [
        "Art","Baking","Badminton","Chess",
        "Climbing","Cycling",
        "Dancing","Fishing","Football",
        "Music","Piano","Pottery",
        "Swimming","Volleyball","Yoga"
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

    const rec = JSON.parse(lsGet(LS.recentList, "[]"));

    if (!rec.length) {
        container.innerHTML = `<p class="muted">No recent searches yet — try tapping a category!</p>`;
        return;
    }

    container.innerHTML = "";
    // cap to 4 so they stay on one line
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

    // Load saved profile for THIS user
    const saved = JSON.parse(lsGet(LS.profile, "{}"));

    avatar.src = saved.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'/%3E";
    if (preview)   preview.src    = saved.avatar || avatar.src;
    if (nameInput) nameInput.value = saved.name  || "";
    if (emailInput)emailInput.value= saved.email || "";

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
            name:    nameInput?.value   || "",
            email:   emailInput?.value || "",
            avatar: preview?.src        || avatar.src
        };
        // save per user
        lsSet(LS.profile, JSON.stringify(profile));

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

    const savedDistance = lsGet(LS.searchDistance, "5");
    slider.value = savedDistance;
    label.textContent = savedDistance + " km";

    slider.addEventListener("input", () => {
        label.textContent = slider.value + " km";
        lsSet(LS.searchDistance, slider.value);
    });

    function updateDistanceVisibility() {
        const modeSel = $("searchMode");
        if (!modeSel || !distanceRow) return;
        distanceRow.style.display = (modeSel.value === "location") ? "flex" : "none";
    }

    $("searchMode") && $("searchMode").addEventListener("change", () => {
        persistSettingsFromDOM();
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

// Service Worker registration
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => {
            console.log("Service Worker Registered");
        })
        .catch(error => {
            console.log("Service Worker Registration Failed", error);
        });
}
<<<<<<< HEAD

// Offline alert on page load
window.addEventListener("load", () => {
    if (!navigator.onLine) {
        alert("You are offline. Only saved places are available.");
    }
});
=======
>>>>>>> 56c8a92f93f0bdb3ff964dfab386c1db8132968e
