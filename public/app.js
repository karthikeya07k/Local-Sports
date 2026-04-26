const state = {
  token: localStorage.getItem("sports_token") || "",
  user: null,
  games: [],
  onboardingStep: 1,
  eventSource: null,
  realtimePollTimer: null
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dom = {
  authSection: document.getElementById("authSection"),
  appSection: document.getElementById("appSection"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  showLoginBtn: document.getElementById("showLoginBtn"),
  showRegisterBtn: document.getElementById("showRegisterBtn"),
  sidebarName: document.getElementById("sidebarName"),
  sidebarMeta: document.getElementById("sidebarMeta"),
  realtimeStatus: document.getElementById("realtimeStatus"),
  logoutBtn: document.getElementById("logoutBtn"),
  navButtons: document.getElementById("navButtons"),
  adminNavBtn: document.getElementById("adminNavBtn"),
  toastContainer: document.getElementById("toastContainer"),
  refreshDashboardBtn: document.getElementById("refreshDashboardBtn"),
  refreshRequestsBtn: document.getElementById("refreshRequestsBtn"),
  refreshHistoryBtn: document.getElementById("refreshHistoryBtn"),
  refreshAdminBtn: document.getElementById("refreshAdminBtn"),
  homeKpis: document.getElementById("homeKpis"),
  recommendationsList: document.getElementById("recommendationsList"),
  notificationList: document.getElementById("notificationList"),
  onboardingForm: document.getElementById("onboardingForm"),
  onboardingGames: document.getElementById("onboardingGames"),
  onboardingAvailability: document.getElementById("onboardingAvailability"),
  onboardCity: document.getElementById("onboardCity"),
  onboardArea: document.getElementById("onboardArea"),
  onboardLat: document.getElementById("onboardLat"),
  onboardLng: document.getElementById("onboardLng"),
  onboardGeoStatus: document.getElementById("onboardGeoStatus"),
  onboardUseLocationBtn: document.getElementById("onboardUseLocationBtn"),
  onboardSkill: document.getElementById("onboardSkill"),
  onboardBio: document.getElementById("onboardBio"),
  addOnboardingSlotBtn: document.getElementById("addOnboardingSlotBtn"),
  onboardPrevBtn: document.getElementById("onboardPrevBtn"),
  onboardNextBtn: document.getElementById("onboardNextBtn"),
  onboardSaveBtn: document.getElementById("onboardSaveBtn"),
  searchForm: document.getElementById("searchForm"),
  searchGame: document.getElementById("searchGame"),
  searchSkill: document.getElementById("searchSkill"),
  searchDay: document.getElementById("searchDay"),
  searchTime: document.getElementById("searchTime"),
  searchRadius: document.getElementById("searchRadius"),
  searchLat: document.getElementById("searchLat"),
  searchLng: document.getElementById("searchLng"),
  searchUseLocationBtn: document.getElementById("searchUseLocationBtn"),
  searchLocation: document.getElementById("searchLocation"),
  searchMessage: document.getElementById("searchMessage"),
  searchResults: document.getElementById("searchResults"),
  incomingRequests: document.getElementById("incomingRequests"),
  outgoingRequests: document.getElementById("outgoingRequests"),
  historyList: document.getElementById("historyList"),
  profileForm: document.getElementById("profileForm"),
  profileName: document.getElementById("profileName"),
  profileCity: document.getElementById("profileCity"),
  profileArea: document.getElementById("profileArea"),
  profileLat: document.getElementById("profileLat"),
  profileLng: document.getElementById("profileLng"),
  profileUseLocationBtn: document.getElementById("profileUseLocationBtn"),
  profileSkill: document.getElementById("profileSkill"),
  profileBio: document.getElementById("profileBio"),
  profileGames: document.getElementById("profileGames"),
  profileLocations: document.getElementById("profileLocations"),
  profileAvailability: document.getElementById("profileAvailability"),
  addProfileSlotBtn: document.getElementById("addProfileSlotBtn"),
  communityForm: document.getElementById("communityForm"),
  communityName: document.getElementById("communityName"),
  communityDescription: document.getElementById("communityDescription"),
  communityLocality: document.getElementById("communityLocality"),
  communityGames: document.getElementById("communityGames"),
  communityList: document.getElementById("communityList"),
  sessionForm: document.getElementById("sessionForm"),
  sessionCommunityId: document.getElementById("sessionCommunityId"),
  sessionGame: document.getElementById("sessionGame"),
  sessionLocation: document.getElementById("sessionLocation"),
  sessionDay: document.getElementById("sessionDay"),
  sessionTime: document.getElementById("sessionTime"),
  sessionRecurring: document.getElementById("sessionRecurring"),
  sessionSlots: document.getElementById("sessionSlots"),
  sessionList: document.getElementById("sessionList"),
  adminKpis: document.getElementById("adminKpis"),
  addGameForm: document.getElementById("addGameForm"),
  adminGameName: document.getElementById("adminGameName"),
  adminGameCategory: document.getElementById("adminGameCategory"),
  adminUsers: document.getElementById("adminUsers"),
  adminReports: document.getElementById("adminReports"),
  adminCommunities: document.getElementById("adminCommunities")
};

const onboardingPanes = Array.from(document.querySelectorAll(".onboard-pane"));
const onboardingSteps = Array.from(document.querySelectorAll(".step"));
const panels = Array.from(document.querySelectorAll(".panel"));
const navBtns = Array.from(document.querySelectorAll(".nav-btn"));

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(title, message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3800);
}

async function api(path, options = {}) {
  const config = { ...options };
  const headers = { ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (config.body && typeof config.body !== "string") {
    headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  config.headers = headers;

  const response = await fetch(path, config);
  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }
  if (!response.ok) {
    if (response.status === 401 && state.token) {
      hardLogout(false);
    }
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function updateRealtimeStatus(statusText, online = true) {
  dom.realtimeStatus.textContent = `Realtime: ${statusText}`;
  dom.realtimeStatus.classList.remove("online", "offline");
  dom.realtimeStatus.classList.add(online ? "online" : "offline");
}

function normalizeClientCoordinates(latValue, lngValue) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function getCoordinatesFromInputs(latInput, lngInput) {
  if (!latInput || !lngInput) {
    return null;
  }
  const latRaw = String(latInput.value || "").trim();
  const lngRaw = String(lngInput.value || "").trim();
  if (!latRaw && !lngRaw) {
    return null;
  }
  return normalizeClientCoordinates(latRaw, lngRaw);
}

function setCoordinatesInInputs(latInput, lngInput, coords) {
  if (!latInput || !lngInput || !coords) {
    return;
  }
  latInput.value = String(coords.lat);
  lngInput.value = String(coords.lng);
}

function requestBrowserCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = normalizeClientCoordinates(position.coords.latitude, position.coords.longitude);
        if (!coords) {
          reject(new Error("Could not read a valid location from the browser."));
          return;
        }
        resolve(coords);
      },
      () => {
        reject(new Error("Location access was denied. Enable GPS/location permission and try again."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

function addSlot(container, slot = { day: "Saturday", start: "18:00", end: "19:00" }) {
  const row = document.createElement("div");
  row.className = "slot-row";
  row.innerHTML = `
    <select class="slot-day">
      ${DAYS.map(
        (day) => `<option value="${escapeHtml(day)}" ${day === slot.day ? "selected" : ""}>${escapeHtml(day)}</option>`
      ).join("")}
    </select>
    <input class="slot-start" type="time" value="${escapeHtml(slot.start || "18:00")}" />
    <input class="slot-end" type="time" value="${escapeHtml(slot.end || "19:00")}" />
    <button type="button" class="btn-inline slot-remove">Remove</button>
  `;
  row.querySelector(".slot-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function collectSlots(container) {
  return Array.from(container.querySelectorAll(".slot-row"))
    .map((row) => ({
      day: row.querySelector(".slot-day").value,
      start: row.querySelector(".slot-start").value,
      end: row.querySelector(".slot-end").value
    }))
    .filter((slot) => slot.day && slot.start && slot.end);
}

function renderGameChips(container, games, selected = []) {
  const selectedSet = new Set(selected);
  container.innerHTML = games
    .map(
      (game) => `
      <label class="chip ${selectedSet.has(game.name) ? "active" : ""}">
        <input type="checkbox" value="${escapeHtml(game.name)}" ${selectedSet.has(game.name) ? "checked" : ""}/>
        ${escapeHtml(game.name)} <span class="muted">(${escapeHtml(game.category)})</span>
      </label>
    `
    )
    .join("");

  container.querySelectorAll(".chip input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      checkbox.closest(".chip").classList.toggle("active", checkbox.checked);
    });
  });
}

function getCheckedChipValues(container) {
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map((input) => input.value);
}

function setSelectOptions(select, values, includeEmpty = false) {
  const fragment = document.createDocumentFragment();
  if (includeEmpty) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Any";
    fragment.appendChild(emptyOption);
  }
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fragment.appendChild(option);
  }
  select.innerHTML = "";
  select.appendChild(fragment);
}

function showAuthForm(type) {
  const isLogin = type === "login";
  dom.loginForm.classList.toggle("hidden", !isLogin);
  dom.registerForm.classList.toggle("hidden", isLogin);
  dom.showLoginBtn.classList.toggle("active", isLogin);
  dom.showRegisterBtn.classList.toggle("active", !isLogin);
}

function showSection(sectionId) {
  for (const panel of panels) {
    panel.classList.toggle("active", panel.id === `${sectionId}Section`);
  }
  for (const btn of navBtns) {
    btn.classList.toggle("active", btn.dataset.section === sectionId);
  }
}

function updateSidebar() {
  if (!state.user) {
    return;
  }
  dom.sidebarName.textContent = state.user.name;
  const coordText = state.user.coordinates ? ` - ${state.user.coordinates.lat}, ${state.user.coordinates.lng}` : "";
  dom.sidebarMeta.textContent = `${state.user.role.toUpperCase()} - ${state.user.city || "City not set"}${
    state.user.area ? ` - ${state.user.area}` : ""
  }${coordText}`;
  const adminVisible = state.user.role === "admin";
  dom.adminNavBtn.classList.toggle("hidden", !adminVisible);
  if (!adminVisible && document.getElementById("adminSection").classList.contains("active")) {
    showSection("home");
  }
}

function buildPlaceholder(text) {
  return `<div class="placeholder">${escapeHtml(text)}</div>`;
}

function formatDate(iso) {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  return d.toLocaleString();
}

function setHomeKpis(kpis) {
  const entries = [
    ["Incoming Pending", kpis.incomingPending ?? 0],
    ["Outgoing Pending", kpis.outgoingPending ?? 0],
    ["Successful Matches", kpis.successfulMatches ?? 0],
    ["Nearby Players", kpis.nearbyUsers ?? 0]
  ];
  dom.homeKpis.innerHTML = entries
    .map(
      ([label, value]) => `
      <article class="kpi">
        <h4>${escapeHtml(label)}</h4>
        <p>${escapeHtml(value)}</p>
      </article>
    `
    )
    .join("");
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  setHomeKpis(data.kpis || {});
  if (!data.recommendations || data.recommendations.length === 0) {
    dom.recommendationsList.innerHTML = buildPlaceholder("No recommendations yet. Complete onboarding and run a search.");
  } else {
    dom.recommendationsList.innerHTML = data.recommendations
      .map(
        (rec) => `
          <article class="item">
            <div class="item-head">
              <p class="item-title">${escapeHtml(rec.name)}</p>
              <span class="status-pill">${escapeHtml(rec.skillLevel)}</span>
            </div>
            <p>${escapeHtml(rec.city || "Unknown city")} ${rec.area ? "- " + escapeHtml(rec.area) : ""}</p>
            <p>${rec.distanceKm == null ? "Distance unavailable" : `${escapeHtml(rec.distanceKm)} km away`}</p>
            <p>${escapeHtml((rec.preferredGames || []).join(", ") || "No games set")}</p>
          </article>
        `
      )
      .join("");
  }

  if (!data.notifications || data.notifications.length === 0) {
    dom.notificationList.innerHTML = buildPlaceholder("Realtime notifications will appear here.");
  } else {
    dom.notificationList.innerHTML = data.notifications
      .map(
        (note) => `
        <article class="item">
          <p class="item-title">${escapeHtml(note.message)}</p>
          <p>${escapeHtml(formatDate(note.createdAt))}</p>
        </article>
      `
      )
      .join("");
  }
}

function renderRequestList(container, requests, direction) {
  if (!requests || requests.length === 0) {
    container.innerHTML = buildPlaceholder("No requests in this category.");
    return;
  }
  container.innerHTML = requests
    .map((request) => {
      const peer = direction === "incoming" ? request.fromUser : request.toUser;
      const displayStatus = request.status === "declined" ? "rejected" : request.status;
      const pendingActions =
        request.status === "pending"
          ? direction === "incoming"
            ? `
          <button class="btn-inline" data-request-action="accepted" data-request-id="${escapeHtml(request.id)}">Accept</button>
          <button class="btn-inline" data-request-action="declined" data-request-id="${escapeHtml(request.id)}">Reject</button>
        `
            : `<button class="btn-inline" data-request-action="cancelled" data-request-id="${escapeHtml(request.id)}">Cancel</button>`
          : "";
      return `
        <article class="item">
          <div class="item-head">
            <p class="item-title">${escapeHtml(peer?.name || "Unknown Player")} - ${escapeHtml(request.game)}</p>
            <span class="status-pill ${escapeHtml(request.status)}">${escapeHtml(displayStatus)}</span>
          </div>
          <p>${escapeHtml(request.location)} - ${escapeHtml(request.day)} ${escapeHtml(request.time)}</p>
          ${request.message ? `<p>${escapeHtml(request.message)}</p>` : ""}
          <p>${escapeHtml(formatDate(request.createdAt))}</p>
          <div class="actions">${pendingActions}</div>
        </article>
      `;
    })
    .join("");
}

async function loadRequests() {
  const [incomingData, outgoingData] = await Promise.all([
    api("/api/requests?type=incoming"),
    api("/api/requests?type=outgoing")
  ]);
  renderRequestList(dom.incomingRequests, incomingData.requests || [], "incoming");
  renderRequestList(dom.outgoingRequests, outgoingData.requests || [], "outgoing");
}

async function loadHistory() {
  const data = await api("/api/history");
  if (!data.history || data.history.length === 0) {
    dom.historyList.innerHTML = buildPlaceholder("No play history yet.");
    return;
  }
  dom.historyList.innerHTML = data.history
    .map(
      (entry) => `
      <article class="item">
        <div class="item-head">
          <p class="item-title">${escapeHtml(entry.partnerName)} - ${escapeHtml(entry.game)}</p>
          <span class="status-pill ${escapeHtml(entry.status)}">${escapeHtml(
            entry.status === "declined" ? "rejected" : entry.status
          )}</span>
        </div>
        <p>${escapeHtml(entry.location)} - ${escapeHtml(entry.day)} ${escapeHtml(entry.time)}</p>
        <p>${escapeHtml(formatDate(entry.updatedAt))}</p>
      </article>
    `
    )
    .join("");
}

function renderCommunityList(communities) {
  if (!communities || communities.length === 0) {
    dom.communityList.innerHTML = buildPlaceholder("No communities yet. Create the first one.");
    return;
  }
  dom.communityList.innerHTML = communities
    .map((community) => {
      const action = community.isMember
        ? community.organizerId === state.user.id
          ? ""
          : `<button class="btn-inline" data-community-action="leave" data-community-id="${escapeHtml(
              community.id
            )}">Leave</button>`
        : `<button class="btn-inline" data-community-action="join" data-community-id="${escapeHtml(
            community.id
          )}">Join</button>`;
      return `
        <article class="item">
          <div class="item-head">
            <p class="item-title">${escapeHtml(community.name)}</p>
            <span class="status-pill ${community.verified ? "verified" : "pending"}">
              ${community.verified ? "Verified" : "Pending"}
            </span>
          </div>
          <p>${escapeHtml(community.locality)} - Members: ${escapeHtml(community.memberCount)}</p>
          <p>${escapeHtml((community.games || []).join(", "))}</p>
          <p>Organizer: ${escapeHtml(community.organizerName)}</p>
          ${community.description ? `<p>${escapeHtml(community.description)}</p>` : ""}
          <div class="actions">${action}</div>
        </article>
      `;
    })
    .join("");
}

function populateSessionCommunityOptions(communities) {
  const memberCommunities = communities.filter((community) => community.isMember);
  dom.sessionCommunityId.innerHTML = "";
  if (memberCommunities.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Join a community first";
    dom.sessionCommunityId.appendChild(option);
    return;
  }
  for (const community of memberCommunities) {
    const option = document.createElement("option");
    option.value = community.id;
    option.textContent = `${community.name} (${community.locality})`;
    dom.sessionCommunityId.appendChild(option);
  }
}

function renderSessionList(sessions) {
  if (!sessions || sessions.length === 0) {
    dom.sessionList.innerHTML = buildPlaceholder("No open sessions posted yet.");
    return;
  }
  dom.sessionList.innerHTML = sessions
    .map((session) => {
      const participantText = (session.participants || []).map((p) => p.name).join(", ");
      const action = session.joined
        ? "<span class='status-pill accepted'>Joined</span>"
        : `<button class="btn-inline" data-session-action="join" data-session-id="${escapeHtml(session.id)}">Join Session</button>`;
      return `
        <article class="item">
          <div class="item-head">
            <p class="item-title">${escapeHtml(session.communityName)} - ${escapeHtml(session.game)}</p>
            <span class="status-pill">${escapeHtml(session.recurring || "none")}</span>
          </div>
          <p>${escapeHtml(session.location)} - ${escapeHtml(session.day)} ${escapeHtml(session.time)}</p>
          <p>Created by ${escapeHtml(session.createdByName)} ${
            session.slotsLeft === null ? "" : `- Slots left: ${escapeHtml(session.slotsLeft)}`
          }</p>
          <p>Participants: ${escapeHtml(participantText || "None")}</p>
          <div class="actions">${action}</div>
        </article>
      `;
    })
    .join("");
}

async function loadCommunitiesAndSessions() {
  const [communitiesData, sessionsData] = await Promise.all([api("/api/communities"), api("/api/community-sessions")]);
  const communities = communitiesData.communities || [];
  renderCommunityList(communities);
  populateSessionCommunityOptions(communities);
  renderSessionList(sessionsData.sessions || []);
}

function fillProfileForm(user) {
  dom.profileName.value = user.name || "";
  dom.profileCity.value = user.city || "";
  dom.profileArea.value = user.area || "";
  setCoordinatesInInputs(dom.profileLat, dom.profileLng, user.coordinates || null);
  dom.profileSkill.value = user.skillLevel || "beginner";
  dom.profileBio.value = user.bio || "";
  dom.profileLocations.value = (user.preferredLocations || []).join(", ");
  renderGameChips(dom.profileGames, state.games, user.preferredGames || []);

  dom.profileAvailability.innerHTML = "";
  const slots = user.availability && user.availability.length > 0 ? user.availability : [{ day: "Saturday", start: "18:00", end: "19:00" }];
  for (const slot of slots) {
    addSlot(dom.profileAvailability, slot);
  }
}

function fillOnboardingForm(user) {
  renderGameChips(dom.onboardingGames, state.games, user.preferredGames || []);
  dom.onboardCity.value = user.city || "";
  dom.onboardArea.value = user.area || "";
  setCoordinatesInInputs(dom.onboardLat, dom.onboardLng, user.coordinates || null);
  dom.onboardGeoStatus.textContent = user.coordinates
    ? `Coordinates set: ${user.coordinates.lat}, ${user.coordinates.lng}`
    : "No coordinates set";
  dom.onboardSkill.value = user.skillLevel || "beginner";
  dom.onboardBio.value = user.bio || "";
  dom.onboardingAvailability.innerHTML = "";
  const slots = user.availability && user.availability.length > 0 ? user.availability : [{ day: "Saturday", start: "18:00", end: "19:00" }];
  for (const slot of slots) {
    addSlot(dom.onboardingAvailability, slot);
  }
}

function setOnboardingStep(step) {
  state.onboardingStep = Math.max(1, Math.min(3, step));
  onboardingPanes.forEach((pane) => {
    pane.classList.toggle("active", Number(pane.dataset.step) === state.onboardingStep);
  });
  onboardingSteps.forEach((stepEl) => {
    stepEl.classList.toggle("active", Number(stepEl.dataset.step) === state.onboardingStep);
  });
  dom.onboardPrevBtn.classList.toggle("hidden", state.onboardingStep === 1);
  dom.onboardNextBtn.classList.toggle("hidden", state.onboardingStep === 3);
  dom.onboardSaveBtn.classList.toggle("hidden", state.onboardingStep !== 3);
}

function populateGameSelects() {
  const gameNames = state.games.map((game) => game.name);
  setSelectOptions(dom.searchGame, gameNames, true);
  setSelectOptions(dom.sessionGame, gameNames, false);
  renderGameChips(dom.communityGames, state.games, []);
}

async function loadGames() {
  const data = await api("/api/games");
  state.games = data.games || [];
  populateGameSelects();
}

async function refreshUser() {
  const me = await api("/api/me");
  state.user = me.user;
  updateSidebar();
  fillProfileForm(state.user);
  fillOnboardingForm(state.user);
  if (state.user.coordinates) {
    setCoordinatesInInputs(dom.searchLat, dom.searchLng, state.user.coordinates);
  }
}

async function loadAdmin() {
  if (!state.user || state.user.role !== "admin") {
    return;
  }
  const [overview, users, reports, communities] = await Promise.all([
    api("/api/admin/overview"),
    api("/api/admin/users"),
    api("/api/admin/reports"),
    api("/api/communities")
  ]);

  const kpis = overview.kpis || {};
  dom.adminKpis.innerHTML = [
    ["Registered Users", kpis.registeredUsers ?? 0],
    ["Active Requests", kpis.activePlayRequests ?? 0],
    ["Successful Match %", `${kpis.successfulMatchRate ?? 0}%`],
    ["Monthly Active Users", kpis.monthlyActiveUsers ?? 0],
    ["Repeat Engagement %", `${kpis.repeatEngagementRate ?? 0}%`],
    ["Open Reports", kpis.openReports ?? 0],
    ["Pending Communities", kpis.pendingCommunities ?? 0]
  ]
    .map(
      ([label, value]) => `
      <article class="kpi">
        <h4>${escapeHtml(label)}</h4>
        <p>${escapeHtml(value)}</p>
      </article>
    `
    )
    .join("");

  const userItems = users.users || [];
  if (userItems.length === 0) {
    dom.adminUsers.innerHTML = buildPlaceholder("No users found.");
  } else {
    dom.adminUsers.innerHTML = userItems
      .map(
        (user) => `
        <article class="item">
          <div class="item-head">
            <p class="item-title">${escapeHtml(user.name)} (${escapeHtml(user.email)})</p>
            <span class="status-pill ${user.isActive ? "accepted" : "declined"}">${user.isActive ? "Active" : "Inactive"}</span>
          </div>
          <p>${escapeHtml(user.role)} - Requests: ${escapeHtml(user.requestCount)}</p>
          <div class="actions">
            <button class="btn-inline" data-admin-action="toggle-active" data-user-id="${escapeHtml(user.id)}" data-user-active="${escapeHtml(
              user.isActive
            )}">
              ${user.isActive ? "Deactivate" : "Activate"}
            </button>
            <button class="btn-inline" data-admin-action="set-role" data-user-id="${escapeHtml(user.id)}" data-role="user">Make Player</button>
            <button class="btn-inline" data-admin-action="set-role" data-user-id="${escapeHtml(user.id)}" data-role="organizer">Make Organizer</button>
            <button class="btn-inline" data-admin-action="set-role" data-user-id="${escapeHtml(user.id)}" data-role="admin">Make Admin</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  const reportItems = reports.reports || [];
  if (reportItems.length === 0) {
    dom.adminReports.innerHTML = buildPlaceholder("No reports submitted.");
  } else {
    dom.adminReports.innerHTML = reportItems
      .map(
        (report) => `
        <article class="item">
          <div class="item-head">
            <p class="item-title">${escapeHtml(report.reason)}</p>
            <span class="status-pill ${escapeHtml(report.status)}">${escapeHtml(report.status)}</span>
          </div>
          <p>Reporter: ${escapeHtml(report.reporterName || "Unknown")} - Target: ${escapeHtml(report.targetType)} (${escapeHtml(
            report.targetId
          )})</p>
          ${report.details ? `<p>${escapeHtml(report.details)}</p>` : ""}
          <p>${escapeHtml(formatDate(report.createdAt))}</p>
          <div class="actions">
            <button class="btn-inline" data-report-action="resolved" data-report-id="${escapeHtml(report.id)}">Resolve</button>
            <button class="btn-inline" data-report-action="dismissed" data-report-id="${escapeHtml(report.id)}">Dismiss</button>
            <button class="btn-inline" data-report-action="open" data-report-id="${escapeHtml(report.id)}">Reopen</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  const communityItems = (communities.communities || []).filter((community) => !community.verified);
  if (communityItems.length === 0) {
    dom.adminCommunities.innerHTML = buildPlaceholder("No pending communities.");
  } else {
    dom.adminCommunities.innerHTML = communityItems
      .map(
        (community) => `
        <article class="item">
          <div class="item-head">
            <p class="item-title">${escapeHtml(community.name)}</p>
            <span class="status-pill pending">Pending</span>
          </div>
          <p>${escapeHtml(community.locality)} - Organizer: ${escapeHtml(community.organizerName)}</p>
          <p>${escapeHtml((community.games || []).join(", "))}</p>
          <div class="actions">
            <button class="btn-inline" data-community-verify="true" data-community-id="${escapeHtml(community.id)}">Verify</button>
          </div>
        </article>
      `
      )
      .join("");
  }
}

async function searchPlayers() {
  const params = new URLSearchParams();
  if (dom.searchGame.value) params.set("game", dom.searchGame.value);
  if (dom.searchSkill.value) params.set("skill", dom.searchSkill.value);
  if (dom.searchDay.value) params.set("day", dom.searchDay.value);
  if (dom.searchTime.value) params.set("time", dom.searchTime.value);
  if (dom.searchLocation.value) params.set("location", dom.searchLocation.value.trim());
  const radiusValue = Number(dom.searchRadius.value || 5);
  params.set("radiusKm", String(Number.isFinite(radiusValue) ? radiusValue : 5));

  const searchCoords =
    getCoordinatesFromInputs(dom.searchLat, dom.searchLng) || (state.user ? state.user.coordinates : null);
  if (!searchCoords) {
    throw new Error("Set latitude/longitude or click 'Use My Current Location' before searching.");
  }
  params.set("lat", String(searchCoords.lat));
  params.set("lng", String(searchCoords.lng));

  const data = await api(`/api/players/search?${params.toString()}`);
  const players = data.players || [];
  if (players.length === 0) {
    dom.searchResults.innerHTML = buildPlaceholder("No matching players found. Try a broader search.");
    return;
  }
  dom.searchResults.innerHTML = players
    .map(
      (entry) => `
      <article class="item">
        <div class="item-head">
          <p class="item-title">${escapeHtml(entry.user.name)}</p>
          <span class="status-pill">${escapeHtml(entry.user.skillLevel)}</span>
        </div>
        <p>${escapeHtml(entry.user.city || "")} ${entry.user.area ? "- " + escapeHtml(entry.user.area) : ""}</p>
        <p>${escapeHtml(entry.distanceKm)} km away</p>
        <p>Games: ${escapeHtml((entry.user.preferredGames || []).join(", ") || "Not set")}</p>
        <p>Common Games: ${escapeHtml((entry.commonGames || []).join(", ") || "None yet")} - Match score: ${escapeHtml(
          entry.matchScore
        )}</p>
        <p>Availability: ${escapeHtml(
          (entry.user.availability || []).map((slot) => `${slot.day} ${slot.start}-${slot.end}`).join(", ") || "Not set"
        )}</p>
        <div class="actions">
          <button class="btn-inline" data-send-request="${escapeHtml(entry.user.id)}">Send Play Request</button>
          <button class="btn-inline" data-report-user="${escapeHtml(entry.user.id)}">Report</button>
        </div>
      </article>
    `
    )
    .join("");
}

async function sendPlayRequest(toUserId) {
  const game =
    dom.searchGame.value ||
    (state.user.preferredGames && state.user.preferredGames.length > 0 ? state.user.preferredGames[0] : state.games[0]?.name || "");
  const day = dom.searchDay.value || "Saturday";
  const time = dom.searchTime.value || "18:00";
  const explicitCoords = getCoordinatesFromInputs(dom.searchLat, dom.searchLng);
  const location =
    dom.searchLocation.value.trim() ||
    (explicitCoords ? `${explicitCoords.lat}, ${explicitCoords.lng}` : "") ||
    state.user.area ||
    state.user.city ||
    "Society Clubhouse";
  const message = dom.searchMessage.value.trim() || "Would you like to play?";

  if (!game) {
    showToast("Search Setup Needed", "Select or configure at least one game before sending requests.");
    return;
  }
  await api("/api/requests", {
    method: "POST",
    body: { toUserId, game, location, day, time, message }
  });
  showToast("Request Sent", "Your play request was sent successfully.");
  await Promise.all([loadDashboard(), loadRequests()]);
}

function connectRealtime() {
  if (!state.token) {
    return;
  }
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  const source = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
  state.eventSource = source;

  source.addEventListener("connected", () => {
    updateRealtimeStatus("Online (SSE + auto-sync)", true);
  });
  source.addEventListener("notification", async (event) => {
    try {
      const data = JSON.parse(event.data);
      showToast("Realtime Update", data.message || "New platform update");
      if (
        ["play_request_received", "play_request_updated", "play_request_sent", "session_joined", "community_session_posted"].includes(data.type)
      ) {
        await Promise.all([loadDashboard(), loadRequests(), loadHistory(), loadCommunitiesAndSessions()]);
      } else if (["report_created", "community_verification_pending", "community_verification_updated"].includes(data.type)) {
        await Promise.all([loadDashboard(), loadCommunitiesAndSessions()]);
        if (state.user?.role === "admin") {
          await loadAdmin();
        }
      } else {
        await loadDashboard();
      }
    } catch (_error) {
      showToast("Realtime", "Received a new update.");
    }
  });
  source.onerror = () => {
    updateRealtimeStatus("Degraded (polling active)", true);
  };
}

async function syncRealtimeSnapshot() {
  if (!state.token) {
    return;
  }
  try {
    await Promise.all([loadDashboard(), loadRequests(), loadHistory()]);
    if (document.getElementById("communitiesSection").classList.contains("active")) {
      await loadCommunitiesAndSessions();
    }
    if (state.user?.role === "admin" && document.getElementById("adminSection").classList.contains("active")) {
      await loadAdmin();
    }
  } catch (_error) {
    // Keep polling resilient.
  }
}

function startRealtimePolling() {
  if (state.realtimePollTimer) {
    clearInterval(state.realtimePollTimer);
  }
  state.realtimePollTimer = setInterval(() => {
    syncRealtimeSnapshot();
  }, 8000);
}

function stopRealtimePolling() {
  if (!state.realtimePollTimer) {
    return;
  }
  clearInterval(state.realtimePollTimer);
  state.realtimePollTimer = null;
}

function hardLogout(showMessage = true) {
  state.token = "";
  state.user = null;
  localStorage.removeItem("sports_token");
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  stopRealtimePolling();
  updateRealtimeStatus("Offline", false);
  dom.appSection.classList.add("hidden");
  dom.authSection.classList.remove("hidden");
  showAuthForm("login");
  if (showMessage) {
    showToast("Logged Out", "You have been logged out.");
  }
}

async function softLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (_error) {
    // Ignore errors during local logout.
  } finally {
    hardLogout();
  }
}

async function bootSession() {
  if (!state.token) {
    showAuthForm("login");
    return;
  }
  try {
    dom.authSection.classList.add("hidden");
    dom.appSection.classList.remove("hidden");
    updateRealtimeStatus("Connecting...", true);
    await loadGames();
    await refreshUser();
    await Promise.all([loadDashboard(), loadRequests(), loadHistory(), loadCommunitiesAndSessions()]);
    if (state.user.role === "admin") {
      await loadAdmin();
    }
    setOnboardingStep(1);
    showSection("home");
    startRealtimePolling();
    connectRealtime();
    showToast("Welcome", "Real-time partner finder is ready.");
  } catch (error) {
    hardLogout(false);
    showToast("Session Expired", error.message || "Please log in again.");
  }
}

function bindEvents() {
  dom.showLoginBtn.addEventListener("click", () => showAuthForm("login"));
  dom.showRegisterBtn.addEventListener("click", () => showAuthForm("register"));
  dom.logoutBtn.addEventListener("click", softLogout);

  dom.navButtons.addEventListener("click", async (event) => {
    const button = event.target.closest(".nav-btn");
    if (!button) return;
    const section = button.dataset.section;
    if (section === "admin" && state.user?.role !== "admin") {
      return;
    }
    showSection(section);
    if (section === "admin" && state.user?.role === "admin") {
      await loadAdmin();
    }
    if (section === "communities") {
      await loadCommunitiesAndSessions();
    }
  });

  dom.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(dom.loginForm);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: {
          email: form.get("email"),
          password: form.get("password")
        }
      });
      state.token = data.token;
      localStorage.setItem("sports_token", state.token);
      showToast("Login Successful", "Loading your dashboard.");
      await bootSession();
    } catch (error) {
      showToast("Login Failed", error.message);
    }
  });

  dom.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(dom.registerForm);
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          city: form.get("city"),
          area: form.get("area"),
          role: form.get("role"),
          adminCode: form.get("adminCode")
        }
      });
      state.token = data.token;
      localStorage.setItem("sports_token", state.token);
      showToast("Account Created", data.message || "Welcome to the platform.");
      await bootSession();
    } catch (error) {
      showToast("Registration Failed", error.message);
    }
  });

  dom.refreshDashboardBtn.addEventListener("click", async () => {
    try {
      await loadDashboard();
      showToast("Dashboard", "Refreshed successfully.");
    } catch (error) {
      showToast("Refresh Failed", error.message);
    }
  });

  dom.refreshRequestsBtn.addEventListener("click", async () => {
    try {
      await loadRequests();
      showToast("Requests", "Updated.");
    } catch (error) {
      showToast("Refresh Failed", error.message);
    }
  });

  dom.refreshHistoryBtn.addEventListener("click", async () => {
    try {
      await loadHistory();
      showToast("History", "Updated.");
    } catch (error) {
      showToast("Refresh Failed", error.message);
    }
  });

  dom.refreshAdminBtn.addEventListener("click", async () => {
    try {
      await loadAdmin();
      showToast("Admin", "Dashboard updated.");
    } catch (error) {
      showToast("Admin Refresh Failed", error.message);
    }
  });

  dom.searchUseLocationBtn.addEventListener("click", async () => {
    try {
      const coords = await requestBrowserCoordinates();
      setCoordinatesInInputs(dom.searchLat, dom.searchLng, coords);
      showToast("Location Captured", "Search coordinates updated from your device.");
    } catch (error) {
      showToast("Location Failed", error.message);
    }
  });

  dom.onboardUseLocationBtn.addEventListener("click", async () => {
    try {
      const coords = await requestBrowserCoordinates();
      setCoordinatesInInputs(dom.onboardLat, dom.onboardLng, coords);
      dom.onboardGeoStatus.textContent = `Coordinates set: ${coords.lat}, ${coords.lng}`;
      showToast("Location Captured", "Onboarding coordinates updated.");
    } catch (error) {
      showToast("Location Failed", error.message);
    }
  });

  dom.profileUseLocationBtn.addEventListener("click", async () => {
    try {
      const coords = await requestBrowserCoordinates();
      setCoordinatesInInputs(dom.profileLat, dom.profileLng, coords);
      showToast("Location Captured", "Profile coordinates updated.");
    } catch (error) {
      showToast("Location Failed", error.message);
    }
  });

  dom.addOnboardingSlotBtn.addEventListener("click", () => addSlot(dom.onboardingAvailability));
  dom.addProfileSlotBtn.addEventListener("click", () => addSlot(dom.profileAvailability));
  dom.onboardPrevBtn.addEventListener("click", () => setOnboardingStep(state.onboardingStep - 1));
  dom.onboardNextBtn.addEventListener("click", () => setOnboardingStep(state.onboardingStep + 1));

  dom.onboardingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const preferredLocations = Array.from(
        dom.onboardingForm.querySelectorAll(".inline-checks input[type='checkbox']:checked")
      ).map((item) => item.value);
      const onboardingCoords = getCoordinatesFromInputs(dom.onboardLat, dom.onboardLng);
      const payload = {
        city: dom.onboardCity.value.trim(),
        area: dom.onboardArea.value.trim(),
        skillLevel: dom.onboardSkill.value,
        bio: dom.onboardBio.value.trim(),
        preferredGames: getCheckedChipValues(dom.onboardingGames),
        preferredLocations,
        availability: collectSlots(dom.onboardingAvailability)
      };
      if (onboardingCoords) {
        payload.location = onboardingCoords;
      }
      const data = await api("/api/onboarding", { method: "POST", body: payload });
      state.user = data.user;
      updateSidebar();
      fillProfileForm(state.user);
      await loadDashboard();
      try {
        await searchPlayers();
      } catch (_error) {
        // Search needs location and filters; onboarding completion should not fail because of this.
      }
      setOnboardingStep(1);
      showToast("Onboarding Complete", "Your profile is now discoverable.");
    } catch (error) {
      showToast("Onboarding Failed", error.message);
    }
  });

  dom.profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const profileCoords = getCoordinatesFromInputs(dom.profileLat, dom.profileLng);
      const payload = {
        name: dom.profileName.value.trim(),
        city: dom.profileCity.value.trim(),
        area: dom.profileArea.value.trim(),
        skillLevel: dom.profileSkill.value,
        bio: dom.profileBio.value.trim(),
        preferredGames: getCheckedChipValues(dom.profileGames),
        preferredLocations: dom.profileLocations.value
          .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        availability: collectSlots(dom.profileAvailability)
      };
      if (profileCoords) {
        payload.location = profileCoords;
      }
      const data = await api("/api/profile", { method: "PUT", body: payload });
      state.user = data.user;
      updateSidebar();
      await loadDashboard();
      try {
        await searchPlayers();
      } catch (_error) {
        // Ignore if search coordinates are not currently set.
      }
      showToast("Profile Saved", "Your profile was updated.");
    } catch (error) {
      showToast("Profile Update Failed", error.message);
    }
  });

  dom.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await searchPlayers();
    } catch (error) {
      showToast("Search Failed", error.message);
    }
  });

  dom.searchResults.addEventListener("click", async (event) => {
    const requestBtn = event.target.closest("[data-send-request]");
    if (requestBtn) {
      try {
        await sendPlayRequest(requestBtn.dataset.sendRequest);
      } catch (error) {
        showToast("Request Failed", error.message);
      }
      return;
    }
    const reportBtn = event.target.closest("[data-report-user]");
    if (reportBtn) {
      const targetId = reportBtn.dataset.reportUser;
      const reason = window.prompt("Reason for report (example: misuse, spam, unsafe behavior):", "Misuse");
      if (!reason) return;
      try {
        await api("/api/reports", {
          method: "POST",
          body: {
            targetType: "user",
            targetId,
            reason,
            details: "Submitted from search results"
          }
        });
        showToast("Report Submitted", "The admin team will review this report.");
      } catch (error) {
        showToast("Report Failed", error.message);
      }
    }
  });

  [dom.incomingRequests, dom.outgoingRequests].forEach((container) => {
    container.addEventListener("click", async (event) => {
      const actionBtn = event.target.closest("[data-request-action]");
      if (!actionBtn) return;
      try {
        await api(`/api/requests/${encodeURIComponent(actionBtn.dataset.requestId)}`, {
          method: "PATCH",
          body: { status: actionBtn.dataset.requestAction }
        });
        await Promise.all([loadDashboard(), loadRequests(), loadHistory()]);
        const label = actionBtn.dataset.requestAction === "declined" ? "rejected" : actionBtn.dataset.requestAction;
        showToast("Request Updated", `Request marked as ${label}.`);
      } catch (error) {
        showToast("Update Failed", error.message);
      }
    });
  });

  dom.communityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = {
        name: dom.communityName.value.trim(),
        description: dom.communityDescription.value.trim(),
        locality: dom.communityLocality.value.trim(),
        games: getCheckedChipValues(dom.communityGames)
      };
      await api("/api/communities", { method: "POST", body: payload });
      dom.communityForm.reset();
      renderGameChips(dom.communityGames, state.games, []);
      await Promise.all([loadCommunitiesAndSessions(), loadAdmin()]);
      showToast("Community Created", "Community is created and awaiting verification.");
    } catch (error) {
      showToast("Community Failed", error.message);
    }
  });

  dom.communityList.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("[data-community-action]");
    if (!actionBtn) return;
    const id = actionBtn.dataset.communityId;
    const action = actionBtn.dataset.communityAction;
    try {
      await api(`/api/communities/${encodeURIComponent(id)}/${action}`, { method: "POST" });
      await loadCommunitiesAndSessions();
      showToast("Community Updated", `You ${action}ed the community.`);
    } catch (error) {
      showToast("Community Action Failed", error.message);
    }
  });

  dom.sessionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/community-sessions", {
        method: "POST",
        body: {
          communityId: dom.sessionCommunityId.value,
          game: dom.sessionGame.value,
          location: dom.sessionLocation.value.trim(),
          day: dom.sessionDay.value,
          time: dom.sessionTime.value,
          recurring: dom.sessionRecurring.value,
          slots: Number(dom.sessionSlots.value || 0)
        }
      });
      dom.sessionForm.reset();
      dom.sessionSlots.value = "0";
      await loadCommunitiesAndSessions();
      showToast("Session Posted", "Open play session posted successfully.");
    } catch (error) {
      showToast("Session Failed", error.message);
    }
  });

  dom.sessionList.addEventListener("click", async (event) => {
    const joinBtn = event.target.closest("[data-session-action='join']");
    if (!joinBtn) return;
    try {
      await api(`/api/community-sessions/${encodeURIComponent(joinBtn.dataset.sessionId)}/join`, { method: "POST" });
      await loadCommunitiesAndSessions();
      showToast("Session Joined", "You joined the session.");
    } catch (error) {
      showToast("Join Failed", error.message);
    }
  });

  dom.addGameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/admin/games", {
        method: "POST",
        body: { name: dom.adminGameName.value.trim(), category: dom.adminGameCategory.value }
      });
      dom.adminGameName.value = "";
      await loadGames();
      await loadAdmin();
      showToast("Game Added", "New game category has been added.");
    } catch (error) {
      showToast("Add Game Failed", error.message);
    }
  });

  dom.adminUsers.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-admin-action]");
    if (!button) return;
    const userId = button.dataset.userId;
    const action = button.dataset.adminAction;
    try {
      if (action === "toggle-active") {
        const current = String(button.dataset.userActive) === "true";
        await api(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: { isActive: !current }
        });
      } else if (action === "set-role") {
        await api(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: { role: button.dataset.role }
        });
      }
      await loadAdmin();
      showToast("Admin Update", "User settings updated.");
    } catch (error) {
      showToast("Admin Action Failed", error.message);
    }
  });

  dom.adminReports.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-report-action]");
    if (!button) return;
    const reportId = button.dataset.reportId;
    const status = button.dataset.reportAction;
    try {
      await api(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        body: { status, actionNote: `Updated to ${status} via dashboard` }
      });
      await loadAdmin();
      showToast("Report Updated", `Report marked as ${status}.`);
    } catch (error) {
      showToast("Report Update Failed", error.message);
    }
  });

  dom.adminCommunities.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-community-verify]");
    if (!button) return;
    const communityId = button.dataset.communityId;
    const verified = button.dataset.communityVerify === "true";
    try {
      await api(`/api/admin/communities/${encodeURIComponent(communityId)}/verify`, {
        method: "PATCH",
        body: { verified }
      });
      await Promise.all([loadAdmin(), loadCommunitiesAndSessions()]);
      showToast("Community Verified", "Community verification updated.");
    } catch (error) {
      showToast("Verification Failed", error.message);
    }
  });
}

async function initializeApp() {
  bindEvents();
  showAuthForm("login");
  setOnboardingStep(1);
  if (state.token) {
    await bootSession();
  } else {
    addSlot(dom.onboardingAvailability);
    addSlot(dom.profileAvailability);
  }
}

initializeApp();

