// search.js — Google Maps / Places logic ONLY.

// These globals are shared with core.js:
// - $ helper
// - LS object (localStorage keys)

let placesService = null;
let geocoder = null;
let cityAutocomplete = null;
let userCoords = null;

/* ============================
   SIMPLE UTILS
============================ */
function safeText(s) {
    return s == null ? "" : String(s);
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/* ============================
   INIT APP (Google callback)
============================ */
function initApp() {
    geocoder = new google.maps.Geocoder();
    placesService = new google.maps.places.PlacesService(document.createElement("div"));

    // Autocomplete for city on settings page
    const cityEl = $("cityName");
    if (cityEl) {
        cityAutocomplete = new google.maps.places.Autocomplete(cityEl, {
            types: ["(cities)"],
            fields: ["geometry", "name"]
        });

        cityAutocomplete.addListener("place_changed", () => {
            const p = cityAutocomplete.getPlace();
            if (p && p.geometry) {
                lsSet("hf_last_city", p.name);
                lsSet("hf_last_city_coords", JSON.stringify({
                    lat: p.geometry.location.lat(),
                    lng: p.geometry.location.lng()
                }));
            }
        });
    }

    // If we're on the results page, start flow
    if ($("results")) {
        initResultsFlow();
    }
}

/* ============================
   RESULTS PAGE SEARCH BAR
   (Uses same #searchInput & #searchBtn as home but different behaviour)
============================ */
function initResultsSearchBar() {
    const input = $("searchInput");
    const btn   = $("searchBtn");

    if (!input || !btn) return;

    btn.addEventListener("click", () => {
        const term = input.value.trim();
        if (!term) return;
        // New search with this keyword
        window.location.href = `results.html?query=${encodeURIComponent(term)}`;
    });

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") btn.click();
    });
}

/* ============================
   INIT RESULTS FLOW
============================ */
function initResultsFlow() {
    initResultsSearchBar();

    const params = new URLSearchParams(window.location.search);
    const query  = params.get("query") || lsGet("hf_last_keyword", "") || "";

    const mode   = lsGet(LS.searchMode, "location");
    const titleEl = document.querySelector(".app-title");

    if (titleEl) {
        if (mode === "location") {
            titleEl.textContent = "Results near you";
        } else {
            const cityName = lsGet("hf_last_city", "your city");
            titleEl.textContent = `Results near ${cityName}`;
        }
    }

    const activeTermEl = $("activeTerm");
    if (activeTermEl) {
        activeTermEl.textContent = query
            ? `Showing results for "${query}"`
            : "No search term selected";
    }

    if (!query) {
        $("status") && ($("status").textContent = "No search term selected.");
        return;
    }

    lsSet("hf_last_keyword", query);
    findNearby(query);
}


/* ============================
   FIND NEARBY (MODE SWITCH)
============================ */
function findNearby(keyword) {
    if (typeof persistSettingsFromDOM === "function") {
        persistSettingsFromDOM();
    }

    const mode = lsGet(LS.searchMode, "location");

    if (mode === "location") {
        if (!navigator.geolocation) {
            $("status") && ($("status").textContent = "Geolocation not supported.");
            return;
        }

        $("status") && ($("status").textContent = "Requesting location...");

        navigator.geolocation.getCurrentPosition(
            pos => {
                userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                doPlacesSearch(userCoords, keyword);
            },
            err => {
                $("status") && ($("status").textContent = "Location denied or unavailable.");
                const saved = lsGet("hf_last_city_coords", null);
                if (saved) {
                    userCoords = JSON.parse(saved);
                    doPlacesSearch(userCoords, keyword);
                }
            },
            { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5, timeout: 10000 }
        );
    } else {
        const cityVal = $("cityName")
            ? $("cityName").value.trim()
            : lsGet("hf_last_city", "") || "";

        if (!cityVal) {
            $("status") && ($("status").textContent = "Enter a city to search in settings.");
            return;
        }

        const place = cityAutocomplete ? cityAutocomplete.getPlace() : null;
        if (place && place.geometry) {
            userCoords = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            };
            lsSet("hf_last_city", place.name);
            lsSet("hf_last_city_coords", JSON.stringify(userCoords));
            doPlacesSearch(userCoords, keyword);
            return;
        }

        geocoder.geocode({ address: cityVal }, (results, status) => {
            if (status !== "OK" || !results[0]) {
                $("status") && ($("status").textContent = "City not found.");
                return;
            }
            const loc = results[0].geometry.location;
            userCoords = { lat: loc.lat(), lng: loc.lng() };
            lsSet("hf_last_city", cityVal);
            lsSet("hf_last_city_coords", JSON.stringify(userCoords));
            doPlacesSearch(userCoords, keyword);
        });
    }
}


/* ============================
   DO PLACES SEARCH
============================ */
function doPlacesSearch(coords, keyword) {
    if (!placesService) {
    $("status") && ($("status").textContent = "Maps service still loading...");
    setTimeout(() => doPlacesSearch(coords, keyword), 400);
    return;
}


    $("status") && ($("status").textContent = `Searching for "${keyword}"...`);

    const mode = lsGet(LS.searchMode, "location");
    let distanceKm;

    // Live location → use chosen slider distance
    if (mode === "location") {
        distanceKm = Number(lsGet(LS.searchDistance, "5"))|| 5;
    }
    // City mode → ALWAYS 5 km
    else {
        distanceKm = 5;
    }

    const radiusMeters = distanceKm * 1000;

    const req = {
        location: new google.maps.LatLng(coords.lat, coords.lng),
        radius: radiusMeters,
        keyword
    };

    placesService.nearbySearch(req, async (places, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !places?.length) {
            $("results") && ($("results").innerHTML = `<p class="muted">No results found.</p>`);
            return;
        }

        // Compute distance
        places.forEach(p => {
            const loc = p.geometry.location;
            p.distanceKm = haversineKm(coords.lat, coords.lng, loc.lat(), loc.lng());
        });

        // Rating filter
        const minRating = Number(lsGet(LS.minRating, "0") || 0);
        let filtered = places.filter(p => (p.rating ?? 0) >= minRating);

        // Wheelchair filter
        if (lsGet(LS.wheelchairOnly, "false") === "true") {
            const checks = await Promise.all(
                filtered.map(p => new Promise(res => {
                    placesService.getDetails(
                        { placeId: p.place_id, fields: ["wheelchair_accessible_entrance"] },
                        details => {
                            if (!details) return res(p);
                            if (details.wheelchair_accessible_entrance === false) res(null);
                            else res(p);
                        }
                    );
                }))
            );
            filtered = checks.filter(Boolean);
        }

        // Sorting
        const sort = lsGet(LS.sortOption, "distance");


        if (sort === "distance") {
            filtered.sort((a,b)=> (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
        }
        else if (sort === "rating") {
            filtered.sort((a,b)=> (b.rating ?? 0) - (a.rating ?? 0));
        }
        else if (sort === "alpha") {
            filtered.sort((a,b)=> a.name.localeCompare(b.name));
        }
        renderPlacesList(filtered);
        $("status") && ($("status").textContent = `Found ${filtered.length} results.`);
    });
}

/* ============================
   RENDER RESULTS LIST
============================ */
function renderPlacesList(list) {
    const out = $("results");
    if (!out) return;
    out.innerHTML = "";

    if (!list.length) {
        out.innerHTML = `<p class="muted">No matching places</p>`;
        return;
    }

    list.forEach(place => {
        const photo =
            place.photos && place.photos.length
                ? place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })
                : "https://via.placeholder.com/120x90?text=No+Image";

        const ratingStars = place.rating
            ? "★".repeat(Math.round(place.rating)) + "☆".repeat(5 - Math.round(place.rating))
            : "No rating";

        const distanceStr = place.distanceKm
            ? place.distanceKm.toFixed(1) + " km away"
            : "";

        const card = document.createElement("div");
        card.className = "place-card";

        card.innerHTML = `
            <div class="card-top">
                <img class="place-img" src="${photo}" alt="Preview" />
                <div class="place-info">
                    <div class="place-title">${safeText(place.name)}</div>
                    <div class="place-desc">${safeText(place.vicinity || "No description available")}</div>
                    <div class="place-stars">${ratingStars}</div>
                </div>
            </div>
            <div class="card-bottom">
                <div class="distance">${distanceStr}</div>
                <button class="details-btn">Details</button>
                <button class="favourite-btn">❤️ Add to Favourites</button> <!-- Favourite Button -->
            </div>
            <div class="place-details" style="display:none; margin-top:10px;"></div>
        `;

        out.appendChild(card);

        // Add favourite functionality
        const favouriteBtn = card.querySelector(".favourite-btn");
        favouriteBtn.addEventListener("click", () => addToFavourites(place));

        const detailsBtn = card.querySelector(".details-btn");
        const detailsEl  = card.querySelector(".place-details");

        detailsBtn.addEventListener("click", () => {
            if (detailsEl.style.display === "block") {
                detailsEl.style.display = "none";
                return;
            }

            placesService.getDetails(
                {
                    placeId: place.place_id,
                    fields: [
                        "formatted_phone_number",
                        "website",
                        "opening_hours",
                        "wheelchair_accessible_entrance",
                        "editorial_summary"
                    ]
                },
                details => {
                    if (!details) {
                        detailsEl.innerHTML = `<div class="muted">No further details available.</div>`;
                    } else {
                        let html = "";

                        // About
                        if (details.editorial_summary?.overview) {
                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">About</div>
                                    <div class="detail-text">
                                        ${safeText(details.editorial_summary.overview)}
                                    </div>
                                </div>
                            `;
                        }

                        // Phone
                        if (details.formatted_phone_number) {
                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">Phone</div>
                                    <div class="detail-text">${details.formatted_phone_number}</div>
                                </div>
                            `;
                        }

                        // Website
                        if (details.website) {
                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">Website</div>
                                    <a class="detail-link" href="${details.website}" target="_blank">
                                        Visit Website →
                                    </a>
                                </div>
                            `;
                        }

                        // Hours
                        if (details.opening_hours?.weekday_text) {
                            const hours = details.opening_hours.weekday_text
                                .map(h => `<div class="hour-line">${h}</div>`)
                                .join("");

                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">Hours</div>
                                    <div class="detail-hours">${hours}</div>
                                </div>
                            `;
                        }

                        // Accessibility
                        if (details.wheelchair_accessible_entrance === true) {
                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">Accessibility</div>
                                    <div class="detail-text">♿ Wheelchair accessible</div>
                                </div>
                            `;
                        } else if (details.wheelchair_accessible_entrance === false) {
                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">Accessibility</div>
                                    <div class="detail-text">Not wheelchair accessible</div>
                                </div>
                            `;
                        } else {
                            html += `
                                <div class="detail-block">
                                    <div class="detail-title">Accessibility</div>
                                    <div class="detail-text">Unknown</div>
                                </div>
                            `;
                        }

                        detailsEl.innerHTML = html;
                        detailsEl.style.display = "block";
                    }
                }
            );
        });
    });
}

// Function to add place to favourites
function addToFavourites(place) {
    // 1. Determine the photo URL to save statically
    let photoUrl = "https://via.placeholder.com/120x90?text=No+Image";
    if (place.photos && place.photos.length) {
        // This method call works because Google Maps API is loaded on the results page
        photoUrl = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 });
    }

    // 2. Create a simplified, durable object to save
    const placeToSave = {
        place_id: place.place_id,
        name: place.name,
        vicinity: place.vicinity,
        rating: place.rating,
        distanceKm: place.distanceKm,
        photoUrl: photoUrl // Save the static URL string here
        // We cannot save the full Google PlacePhoto object
    };

    let favourites = JSON.parse(localStorage.getItem("favourites") || "[]");

    // Avoid duplicates
    if (!favourites.some(fav => fav.place_id === placeToSave.place_id)) {
        favourites.push(placeToSave);
        localStorage.setItem("favourites", JSON.stringify(favourites));
        alert(`${placeToSave.name} has been added to your favourites!`);
    } else {
        alert(`${placeToSave.name} is already in your favourites!`);
    }
}


// Expose for Google Maps script callback
window.initApp = initApp;
