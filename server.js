const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const ADMIN_CODE = "SPORTS_ADMIN_2026";
const MAX_NOTIFICATIONS = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "sports_dev_jwt_secret_change_me";
const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 50;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const SSE_CLIENTS = new Map();

function nowISO() {
  return new Date().toISOString();
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const defaultStore = {
      users: [],
      sessions: [],
      games: [
        { id: "game_chess", name: "Chess", category: "Indoor" },
        { id: "game_carrom", name: "Carrom", category: "Indoor" },
        { id: "game_cards", name: "Cards", category: "Indoor" },
        { id: "game_badminton", name: "Badminton", category: "Outdoor" },
        { id: "game_table_tennis", name: "Table Tennis", category: "Indoor" },
        { id: "game_tennis", name: "Tennis", category: "Outdoor" },
        { id: "game_football", name: "Football", category: "Outdoor" },
        { id: "game_cricket", name: "Cricket", category: "Outdoor" }
      ],
      playRequests: [],
      communities: [],
      communitySessions: [],
      reports: [],
      notifications: []
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
  parsed.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  parsed.games = Array.isArray(parsed.games) ? parsed.games : [];
  parsed.playRequests = Array.isArray(parsed.playRequests) ? parsed.playRequests : [];
  parsed.communities = Array.isArray(parsed.communities) ? parsed.communities : [];
  parsed.communitySessions = Array.isArray(parsed.communitySessions) ? parsed.communitySessions : [];
  parsed.reports = Array.isArray(parsed.reports) ? parsed.reports : [];
  parsed.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
  return parsed;
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCoordinates(latValue, lngValue) {
  const lat = toNumber(latValue);
  const lng = toNumber(lngValue);
  if (lat == null || lng == null) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6))
  };
}

function parseCoordinatesFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { provided: false, coords: null, error: "" };
  }
  const hasLocationObject =
    payload.location &&
    typeof payload.location === "object" &&
    (payload.location.lat !== undefined || payload.location.lng !== undefined);
  const hasFlatValues = payload.lat !== undefined || payload.lng !== undefined;

  if (!hasLocationObject && !hasFlatValues) {
    return { provided: false, coords: null, error: "" };
  }

  const lat = hasLocationObject ? payload.location.lat : payload.lat;
  const lng = hasLocationObject ? payload.location.lng : payload.lng;
  const coords = normalizeCoordinates(lat, lng);
  if (!coords) {
    return { provided: true, coords: null, error: "Invalid coordinates. Provide valid lat/lng values." };
  }
  return { provided: true, coords, error: "" };
}

function parseCoordinatesFromQuery(urlObj) {
  const latRaw = urlObj.searchParams.get("lat");
  const lngRaw = urlObj.searchParams.get("lng");
  if (latRaw == null && lngRaw == null) {
    return { provided: false, coords: null, error: "" };
  }
  const coords = normalizeCoordinates(latRaw, lngRaw);
  if (!coords) {
    return { provided: true, coords: null, error: "Invalid lat/lng query coordinates" };
  }
  return { provided: true, coords, error: "" };
}

function getRadiusKm(value) {
  const radius = toNumber(value);
  if (radius == null) {
    return DEFAULT_RADIUS_KM;
  }
  return Math.min(MAX_RADIUS_KM, Math.max(1, radius));
}

function getUserCoordinates(user) {
  if (!user || !user.coordinates || typeof user.coordinates !== "object") {
    return null;
  }
  return normalizeCoordinates(user.coordinates.lat, user.coordinates.lng);
}

function haversineKm(origin, target) {
  const earthRadiusKm = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(target.lat);
  const latDelta = toRad(target.lat - origin.lat);
  const lngDelta = toRad(target.lng - origin.lng);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function createJwtToken(payload, expiresInSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const finalPayload = {
    ...payload,
    iat: now,
    exp: now + Math.max(60, Number(expiresInSeconds || TOKEN_TTL_MS / 1000))
  };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(finalPayload));
  const unsigned = `${headerPart}.${payloadPart}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyJwtToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const unsigned = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signaturePart);
  if (expectedBuffer.length !== actualBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload || typeof payload !== "object") {
      return null;
    }
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (_error) {
    return null;
  }
}

function nextId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512").toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  const computed = hashPassword(password, salt);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(String(expectedHash || ""), "hex");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function sanitizeAvailability(availability) {
  if (!Array.isArray(availability)) {
    return [];
  }
  const out = [];
  for (const slot of availability) {
    if (!slot || typeof slot !== "object") {
      continue;
    }
    const day = normalizeText(slot.day);
    const start = normalizeText(slot.start);
    const end = normalizeText(slot.end);
    if (!day || !start || !end) {
      continue;
    }
    out.push({ day, start, end });
  }
  return out.slice(0, 20);
}

function sanitizeStringArray(values, max = 20) {
  if (!Array.isArray(values)) {
    return [];
  }
  const unique = new Set();
  for (const value of values) {
    const cleaned = normalizeText(value);
    if (cleaned) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique).slice(0, max);
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    city: user.city || "",
    area: user.area || "",
    preferredGames: Array.isArray(user.preferredGames) ? user.preferredGames : [],
    preferredLocations: Array.isArray(user.preferredLocations) ? user.preferredLocations : [],
    skillLevel: user.skillLevel || "beginner",
    availability: Array.isArray(user.availability) ? user.availability : [],
    coordinates: getUserCoordinates(user),
    onboardingCompleted: Boolean(user.onboardingCompleted),
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getToken(req, urlObj) {
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const queryToken = normalizeText(urlObj.searchParams.get("token"));
  return queryToken || "";
}

function cleanupExpiredSessions(store) {
  const now = Date.now();
  store.sessions = store.sessions.filter((session) => {
    const expiry = new Date(session.expiresAt || 0).getTime();
    return Number.isFinite(expiry) && expiry > now;
  });
}

function getSessionAndUser(store, token) {
  cleanupExpiredSessions(store);
  const payload = verifyJwtToken(token);
  if (!payload || !payload.sid || !payload.sub) {
    return { session: null, user: null };
  }
  const session = store.sessions.find(
    (entry) => entry.id === payload.sid && entry.userId === payload.sub && entry.token === token
  );
  if (!session) {
    return { session: null, user: null };
  }
  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user || user.isActive === false) {
    return { session: null, user: null };
  }
  return { session, user };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function parseTimeToMinutes(value) {
  const text = normalizeText(value);
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeMatches(availability, day, time) {
  if (!day) {
    return true;
  }
  const dayLower = day.toLowerCase();
  const targetMinutes = time ? parseTimeToMinutes(time) : null;
  for (const slot of availability || []) {
    const slotDay = normalizeText(slot.day).toLowerCase();
    if (slotDay !== dayLower) {
      continue;
    }
    if (targetMinutes == null) {
      return true;
    }
    const start = parseTimeToMinutes(slot.start);
    const end = parseTimeToMinutes(slot.end);
    if (start == null || end == null) {
      continue;
    }
    if (targetMinutes >= start && targetMinutes <= end) {
      return true;
    }
  }
  return false;
}

function locationMatches(user, locationQuery) {
  if (!locationQuery) {
    return true;
  }
  const needle = normalizeLower(locationQuery);
  const haystack = [
    user.city || "",
    user.area || "",
    ...(Array.isArray(user.preferredLocations) ? user.preferredLocations : [])
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function getCommonGames(currentUser, candidate) {
  const mine = new Set((currentUser.preferredGames || []).map((entry) => normalizeLower(entry)));
  const common = [];
  for (const game of candidate.preferredGames || []) {
    if (mine.has(normalizeLower(game))) {
      common.push(game);
    }
  }
  return common;
}

function scoreCandidate(currentUser, candidate, filters) {
  let score = 0;
  const commonGames = getCommonGames(currentUser, candidate);
  if (commonGames.length > 0) {
    score += 2;
  }
  if (filters.game) {
    const supports = (candidate.preferredGames || []).some(
      (game) => normalizeLower(game) === normalizeLower(filters.game)
    );
    if (supports) {
      score += 3;
    } else {
      score -= 2;
    }
  }
  if (filters.skill && normalizeLower(candidate.skillLevel) === normalizeLower(filters.skill)) {
    score += 2;
  }
  if (filters.day && timeMatches(candidate.availability || [], filters.day, filters.time || "")) {
    score += 2;
  }
  if (filters.location && locationMatches(candidate, filters.location)) {
    score += 3;
  }
  if (Number.isFinite(filters.distanceKm)) {
    const capped = Math.min(20, Math.max(0, filters.distanceKm));
    score += Math.max(0, 4 - capped / 5);
  }
  if (normalizeLower(currentUser.city) && normalizeLower(currentUser.city) === normalizeLower(candidate.city)) {
    score += 1;
  }
  if (normalizeLower(currentUser.area) && normalizeLower(currentUser.area) === normalizeLower(candidate.area)) {
    score += 1;
  }
  return { score, commonGames };
}

function emitSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function registerSseClient(userId, res) {
  if (!SSE_CLIENTS.has(userId)) {
    SSE_CLIENTS.set(userId, new Set());
  }
  SSE_CLIENTS.get(userId).add(res);
}

function unregisterSseClient(userId, res) {
  const set = SSE_CLIENTS.get(userId);
  if (!set) {
    return;
  }
  set.delete(res);
  if (set.size === 0) {
    SSE_CLIENTS.delete(userId);
  }
}

function notifyUsers(store, userIds, type, message, data = {}) {
  const timestamp = nowISO();
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  for (const userId of uniqueUserIds) {
    const notification = {
      id: nextId("notif"),
      userId,
      type,
      message,
      data,
      createdAt: timestamp,
      read: false
    };
    store.notifications.push(notification);
    const clients = SSE_CLIENTS.get(userId);
    if (clients) {
      for (const clientRes of clients) {
        emitSse(clientRes, "notification", notification);
      }
    }
  }

  if (store.notifications.length > MAX_NOTIFICATIONS) {
    store.notifications = store.notifications.slice(-MAX_NOTIFICATIONS);
  }
}

function listAdminIds(store) {
  return store.users.filter((user) => user.role === "admin" && user.isActive !== false).map((user) => user.id);
}

function computeGlobalKpis(store) {
  const pending = store.playRequests.filter((request) => request.status === "pending").length;
  const accepted = store.playRequests.filter((request) => request.status === "accepted").length;
  const completed = store.playRequests.filter((request) => request.status !== "pending").length;
  const successfulMatchRate = completed === 0 ? 0 : (accepted / completed) * 100;
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const monthlyActiveIds = new Set(
    store.sessions
      .filter((session) => new Date(session.createdAt).getTime() >= cutoff)
      .map((session) => session.userId)
  );
  const acceptedByUser = new Map();
  for (const request of store.playRequests) {
    if (request.status !== "accepted") {
      continue;
    }
    acceptedByUser.set(request.fromUserId, (acceptedByUser.get(request.fromUserId) || 0) + 1);
    acceptedByUser.set(request.toUserId, (acceptedByUser.get(request.toUserId) || 0) + 1);
  }
  const usersWithAccepted = Array.from(acceptedByUser.values()).filter((count) => count >= 1).length;
  const repeatUsers = Array.from(acceptedByUser.values()).filter((count) => count > 1).length;
  const repeatEngagementRate = usersWithAccepted === 0 ? 0 : (repeatUsers / usersWithAccepted) * 100;

  return {
    registeredUsers: store.users.length,
    activePlayRequests: pending,
    successfulMatchRate: Number(successfulMatchRate.toFixed(2)),
    monthlyActiveUsers: monthlyActiveIds.size,
    repeatEngagementRate: Number(repeatEngagementRate.toFixed(2))
  };
}

function mapRequestWithUsers(store, request) {
  const fromUser = store.users.find((user) => user.id === request.fromUserId);
  const toUser = store.users.find((user) => user.id === request.toUserId);
  return {
    ...request,
    fromUser: fromUser ? toPublicUser(fromUser) : null,
    toUser: toUser ? toPublicUser(toUser) : null
  };
}

function buildCommunityPayload(store, community, viewerId) {
  const organizer = store.users.find((user) => user.id === community.organizerId);
  return {
    ...community,
    organizerName: organizer ? organizer.name : "Unknown",
    memberCount: Array.isArray(community.memberIds) ? community.memberIds.length : 0,
    isMember: Array.isArray(community.memberIds) ? community.memberIds.includes(viewerId) : false
  };
}

function isAdmin(user) {
  return user && user.role === "admin";
}

function createSession(store, user) {
  const createdAt = nowISO();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const sessionId = nextId("sess");
  const token = createJwtToken(
    {
      sub: user.id,
      sid: sessionId,
      role: user.role
    },
    TOKEN_TTL_MS / 1000
  );
  const session = { id: sessionId, token, userId: user.id, createdAt, expiresAt };
  store.sessions.push(session);
  return session;
}

function requireAuth(store, req, res, urlObj) {
  const token = getToken(req, urlObj);
  if (!token) {
    sendError(res, 401, "Missing authentication token");
    return null;
  }
  const { session, user } = getSessionAndUser(store, token);
  if (!session || !user) {
    sendError(res, 401, "Invalid or expired session");
    return null;
  }
  return { session, user, token };
}

async function handleApi(req, res, urlObj, pathname, store) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "Local Sports Partner Finder", timestamp: nowISO() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/games") {
    const games = [...store.games].sort((a, b) => a.name.localeCompare(b.name));
    sendJson(res, 200, { games });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJsonBody(req);
    const name = normalizeText(body.name);
    const email = normalizeLower(body.email);
    const password = String(body.password || "");
    const city = normalizeText(body.city);
    const area = normalizeText(body.area);
    if (!name || !email || password.length < 6) {
      sendError(res, 400, "Name, valid email, and password (min 6 chars) are required");
      return;
    }
    const existing = store.users.find((entry) => normalizeLower(entry.email) === email);
    if (existing) {
      sendError(res, 409, "Email already registered");
      return;
    }
    let role = ["user", "organizer", "admin"].includes(body.role) ? body.role : "user";
    if (role === "admin" && normalizeText(body.adminCode) !== ADMIN_CODE) {
      role = "user";
    }
    const coordinateResult = parseCoordinatesFromPayload(body);
    if (coordinateResult.error) {
      sendError(res, 400, coordinateResult.error);
      return;
    }

    const salt = createSalt();
    const createdAt = nowISO();
    const user = {
      id: nextId("user"),
      name,
      email,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      role,
      bio: "",
      city,
      area,
      preferredGames: [],
      preferredLocations: ["Home", "Society Clubhouse", "Local Ground"],
      skillLevel: "beginner",
      availability: [],
      coordinates: coordinateResult.coords,
      onboardingCompleted: false,
      isActive: true,
      createdAt,
      updatedAt: createdAt
    };
    store.users.push(user);
    const session = createSession(store, user);
    writeStore(store);
    sendJson(res, 201, {
      token: session.token,
      user: toPublicUser(user),
      message:
        body.role === "admin" && role !== "admin"
          ? "Registered as user. Admin code was invalid."
          : "Registration successful"
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJsonBody(req);
    const email = normalizeLower(body.email);
    const password = String(body.password || "");
    const user = store.users.find((entry) => normalizeLower(entry.email) === email);
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      sendError(res, 401, "Invalid email or password");
      return;
    }
    if (user.isActive === false) {
      sendError(res, 403, "Account is deactivated. Contact admin.");
      return;
    }
    const session = createSession(store, user);
    user.updatedAt = nowISO();
    writeStore(store);
    sendJson(res, 200, { token: session.token, user: toPublicUser(user), message: "Login successful" });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    store.sessions = store.sessions.filter((entry) => entry.id !== auth.session.id);
    writeStore(store);
    sendJson(res, 200, { message: "Logged out" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/events") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const userId = auth.user.id;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    res.write(`retry: 4000\n\n`);
    emitSse(res, "connected", {
      message: "Real-time channel connected",
      userId,
      timestamp: nowISO()
    });

    registerSseClient(userId, res);
    const keepAlive = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      unregisterSseClient(userId, res);
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    sendJson(res, 200, { user: toPublicUser(auth.user) });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/profile") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const body = await readJsonBody(req);
    const user = auth.user;
    const allowedGames = new Set(store.games.map((game) => normalizeLower(game.name)));

    if (body.name !== undefined) {
      user.name = normalizeText(body.name) || user.name;
    }
    if (body.bio !== undefined) {
      user.bio = normalizeText(body.bio).slice(0, 280);
    }
    if (body.city !== undefined) {
      user.city = normalizeText(body.city).slice(0, 60);
    }
    if (body.area !== undefined) {
      user.area = normalizeText(body.area).slice(0, 60);
    }
    if (body.skillLevel !== undefined) {
      const skill = normalizeLower(body.skillLevel);
      if (["beginner", "intermediate", "advanced"].includes(skill)) {
        user.skillLevel = skill;
      }
    }
    if (body.preferredGames !== undefined) {
      const games = sanitizeStringArray(body.preferredGames, 10).filter((game) => allowedGames.has(normalizeLower(game)));
      user.preferredGames = games;
    }
    if (body.preferredLocations !== undefined) {
      user.preferredLocations = sanitizeStringArray(body.preferredLocations, 8);
    }
    if (body.availability !== undefined) {
      user.availability = sanitizeAvailability(body.availability);
    }
    const coordinateResult = parseCoordinatesFromPayload(body);
    if (coordinateResult.error) {
      sendError(res, 400, coordinateResult.error);
      return;
    }
    if (coordinateResult.provided) {
      user.coordinates = coordinateResult.coords;
    }
    if (body.clearCoordinates === true) {
      user.coordinates = null;
    }

    user.onboardingCompleted = Boolean(
      user.preferredGames.length > 0 && user.availability.length > 0 && getUserCoordinates(user)
    );
    user.updatedAt = nowISO();
    writeStore(store);
    sendJson(res, 200, { message: "Profile updated", user: toPublicUser(user) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/onboarding") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const body = await readJsonBody(req);
    auth.user.city = normalizeText(body.city || auth.user.city);
    auth.user.area = normalizeText(body.area || auth.user.area);
    auth.user.bio = normalizeText(body.bio || auth.user.bio).slice(0, 280);
    if (body.skillLevel) {
      const skill = normalizeLower(body.skillLevel);
      if (["beginner", "intermediate", "advanced"].includes(skill)) {
        auth.user.skillLevel = skill;
      }
    }
    if (Array.isArray(body.preferredGames)) {
      const allowedGames = new Set(store.games.map((game) => normalizeLower(game.name)));
      auth.user.preferredGames = sanitizeStringArray(body.preferredGames, 10).filter((game) =>
        allowedGames.has(normalizeLower(game))
      );
    }
    if (Array.isArray(body.preferredLocations)) {
      auth.user.preferredLocations = sanitizeStringArray(body.preferredLocations, 8);
    }
    if (Array.isArray(body.availability)) {
      auth.user.availability = sanitizeAvailability(body.availability);
    }
    const coordinateResult = parseCoordinatesFromPayload(body);
    if (coordinateResult.error) {
      sendError(res, 400, coordinateResult.error);
      return;
    }
    if (coordinateResult.provided) {
      auth.user.coordinates = coordinateResult.coords;
    }
    if (body.clearCoordinates === true) {
      auth.user.coordinates = null;
    }
    auth.user.onboardingCompleted = Boolean(
      auth.user.preferredGames.length > 0 &&
        auth.user.availability.length > 0 &&
        getUserCoordinates(auth.user)
    );
    auth.user.updatedAt = nowISO();
    writeStore(store);
    sendJson(res, 200, { message: "Player onboarding completed", user: toPublicUser(auth.user) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/players/search") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const queryCoords = parseCoordinatesFromQuery(urlObj);
    if (queryCoords.error) {
      sendError(res, 400, queryCoords.error);
      return;
    }
    const originCoords = queryCoords.coords || getUserCoordinates(auth.user);
    if (!originCoords) {
      sendError(
        res,
        400,
        "Coordinates are required for nearby search. Save your location in profile or pass lat/lng in the search query."
      );
      return;
    }
    const filters = {
      game: normalizeText(urlObj.searchParams.get("game")),
      location: normalizeText(urlObj.searchParams.get("location")),
      day: normalizeText(urlObj.searchParams.get("day")),
      time: normalizeText(urlObj.searchParams.get("time")),
      skill: normalizeText(urlObj.searchParams.get("skill")),
      radiusKm: getRadiusKm(urlObj.searchParams.get("radiusKm"))
    };
    const candidates = store.users
      .filter((candidate) => candidate.id !== auth.user.id && candidate.isActive !== false)
      .filter((candidate) => {
        if (filters.game) {
          return (candidate.preferredGames || []).some(
            (game) => normalizeLower(game) === normalizeLower(filters.game)
          );
        }
        return true;
      })
      .filter((candidate) => (filters.skill ? normalizeLower(candidate.skillLevel) === normalizeLower(filters.skill) : true))
      .filter((candidate) => locationMatches(candidate, filters.location))
      .filter((candidate) => timeMatches(candidate.availability || [], filters.day, filters.time))
      .map((candidate) => {
        const candidateCoords = getUserCoordinates(candidate);
        if (!candidateCoords) {
          return null;
        }
        const distanceKm = haversineKm(originCoords, candidateCoords);
        if (distanceKm > filters.radiusKm) {
          return null;
        }
        return {
          candidate,
          distanceKm: Number(distanceKm.toFixed(2))
        };
      })
      .filter(Boolean)
      .map((candidate) => {
        const scored = scoreCandidate(auth.user, candidate.candidate, {
          ...filters,
          distanceKm: candidate.distanceKm
        });
        return {
          user: toPublicUser(candidate.candidate),
          matchScore: scored.score,
          commonGames: scored.commonGames,
          distanceKm: candidate.distanceKm
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || a.user.name.localeCompare(b.user.name));

    sendJson(res, 200, { players: candidates, searchOrigin: originCoords, radiusKm: filters.radiusKm });
    return;
  }

  if (req.method === "POST" && pathname === "/api/requests") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const body = await readJsonBody(req);
    const toUserId = normalizeText(body.toUserId);
    const game = normalizeText(body.game);
    const location = normalizeText(body.location);
    const day = normalizeText(body.day);
    const time = normalizeText(body.time);
    const message = normalizeText(body.message).slice(0, 180);

    if (!toUserId || !game || !location || !day || !time) {
      sendError(res, 400, "toUserId, game, location, day, and time are required");
      return;
    }
    if (toUserId === auth.user.id) {
      sendError(res, 400, "You cannot send a request to yourself");
      return;
    }

    const target = store.users.find((entry) => entry.id === toUserId && entry.isActive !== false);
    if (!target) {
      sendError(res, 404, "Target player not found");
      return;
    }

    const duplicate = store.playRequests.find(
      (entry) =>
        entry.status === "pending" &&
        entry.fromUserId === auth.user.id &&
        entry.toUserId === toUserId &&
        normalizeLower(entry.game) === normalizeLower(game)
    );
    if (duplicate) {
      sendError(res, 409, "A similar pending request already exists");
      return;
    }

    const timestamp = nowISO();
    const request = {
      id: nextId("request"),
      fromUserId: auth.user.id,
      toUserId,
      game,
      location,
      day,
      time,
      message,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.playRequests.push(request);
    notifyUsers(store, [toUserId], "play_request_received", `${auth.user.name} sent a ${game} play request`, {
      requestId: request.id
    });
    notifyUsers(store, [auth.user.id], "play_request_sent", `Request sent to ${target.name}`, {
      requestId: request.id
    });
    writeStore(store);
    sendJson(res, 201, { message: "Play request created", request: mapRequestWithUsers(store, request) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/requests") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const type = normalizeLower(urlObj.searchParams.get("type")) || "all";
    const status = normalizeLower(urlObj.searchParams.get("status"));
    let requests = store.playRequests.filter(
      (entry) => entry.fromUserId === auth.user.id || entry.toUserId === auth.user.id
    );
    if (type === "incoming") {
      requests = requests.filter((entry) => entry.toUserId === auth.user.id);
    } else if (type === "outgoing") {
      requests = requests.filter((entry) => entry.fromUserId === auth.user.id);
    }
    if (status) {
      requests = requests.filter((entry) => normalizeLower(entry.status) === status);
    }
    requests = requests
      .map((entry) => mapRequestWithUsers(store, entry))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    sendJson(res, 200, { requests });
    return;
  }

  const requestMatch = pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (requestMatch && req.method === "PATCH") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const requestId = decodeURIComponent(requestMatch[1]);
    const body = await readJsonBody(req);
    const status = normalizeLower(body.status);
    const request = store.playRequests.find((entry) => entry.id === requestId);
    if (!request) {
      sendError(res, 404, "Play request not found");
      return;
    }
    if (request.status !== "pending") {
      sendError(res, 400, "Only pending requests can be updated");
      return;
    }

    if (["accepted", "declined"].includes(status) && request.toUserId !== auth.user.id) {
      sendError(res, 403, "Only receiver can accept or decline");
      return;
    }
    if (status === "cancelled" && request.fromUserId !== auth.user.id) {
      sendError(res, 403, "Only sender can cancel");
      return;
    }
    if (!["accepted", "declined", "cancelled"].includes(status)) {
      sendError(res, 400, "Invalid status");
      return;
    }

    request.status = status;
    request.updatedAt = nowISO();
    if (status === "accepted") {
      request.matchedAt = request.updatedAt;
    }
    const actorName = auth.user.name;
    notifyUsers(
      store,
      [request.fromUserId, request.toUserId],
      "play_request_updated",
      `${actorName} ${status} a play request`,
      { requestId }
    );
    writeStore(store);
    sendJson(res, 200, { message: `Play request ${status}`, request: mapRequestWithUsers(store, request) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/history") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const history = store.playRequests
      .filter((entry) => entry.fromUserId === auth.user.id || entry.toUserId === auth.user.id)
      .filter((entry) => entry.status !== "pending")
      .map((entry) => {
        const partnerId = entry.fromUserId === auth.user.id ? entry.toUserId : entry.fromUserId;
        const partner = store.users.find((user) => user.id === partnerId);
        return {
          ...entry,
          partnerName: partner ? partner.name : "Unknown"
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    sendJson(res, 200, { history });
    return;
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const incomingPending = store.playRequests.filter(
      (entry) => entry.toUserId === auth.user.id && entry.status === "pending"
    ).length;
    const outgoingPending = store.playRequests.filter(
      (entry) => entry.fromUserId === auth.user.id && entry.status === "pending"
    ).length;
    const accepted = store.playRequests.filter(
      (entry) =>
        (entry.fromUserId === auth.user.id || entry.toUserId === auth.user.id) && entry.status === "accepted"
    ).length;
    const myCoords = getUserCoordinates(auth.user);
    const nearbyUsers = store.users.filter((entry) => {
      if (entry.id === auth.user.id || entry.isActive === false) {
        return false;
      }
      if (!myCoords) {
        return false;
      }
      const entryCoords = getUserCoordinates(entry);
      if (!entryCoords) {
        return false;
      }
      return haversineKm(myCoords, entryCoords) <= DEFAULT_RADIUS_KM;
    }).length;
    const recommendations = store.users
      .filter((candidate) => candidate.id !== auth.user.id && candidate.isActive !== false)
      .map((candidate) => {
        const candidateCoords = getUserCoordinates(candidate);
        const distanceKm =
          myCoords && candidateCoords ? Number(haversineKm(myCoords, candidateCoords).toFixed(2)) : null;
        const scored = scoreCandidate(auth.user, candidate, {
          game: auth.user.preferredGames[0] || "",
          location: auth.user.city || "",
          day: "",
          time: "",
          skill: auth.user.skillLevel || "",
          distanceKm: distanceKm == null ? NaN : distanceKm
        });
        return {
          id: candidate.id,
          name: candidate.name,
          city: candidate.city || "",
          area: candidate.area || "",
          preferredGames: candidate.preferredGames || [],
          skillLevel: candidate.skillLevel || "beginner",
          score: scored.score,
          distanceKm
        };
      })
      .sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm != null) return 1;
        if (a.distanceKm != null && b.distanceKm == null) return -1;
        if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
        return b.score - a.score;
      })
      .slice(0, 5);
    const notifications = store.notifications
      .filter((entry) => entry.userId === auth.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    sendJson(res, 200, {
      kpis: {
        incomingPending,
        outgoingPending,
        successfulMatches: accepted,
        nearbyUsers
      },
      recommendations,
      notifications
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/notifications") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const limit = Number(urlObj.searchParams.get("limit") || 30);
    const notifications = store.notifications
      .filter((entry) => entry.userId === auth.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.max(1, Math.min(limit, 100)));
    sendJson(res, 200, { notifications });
    return;
  }

  if (req.method === "POST" && pathname === "/api/reports") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const body = await readJsonBody(req);
    const targetType = normalizeLower(body.targetType);
    const targetId = normalizeText(body.targetId);
    const reason = normalizeText(body.reason).slice(0, 160);
    const details = normalizeText(body.details).slice(0, 280);
    if (!targetType || !targetId || !reason) {
      sendError(res, 400, "targetType, targetId and reason are required");
      return;
    }
    const report = {
      id: nextId("report"),
      reportedBy: auth.user.id,
      targetType,
      targetId,
      reason,
      details,
      status: "open",
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    store.reports.push(report);
    notifyUsers(store, listAdminIds(store), "report_created", `New misuse report submitted by ${auth.user.name}`, {
      reportId: report.id
    });
    writeStore(store);
    sendJson(res, 201, { message: "Report submitted", report });
    return;
  }

  if (req.method === "GET" && pathname === "/api/communities") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const communities = store.communities
      .map((community) => buildCommunityPayload(store, community, auth.user.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    sendJson(res, 200, { communities });
    return;
  }

  if (req.method === "POST" && pathname === "/api/communities") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const body = await readJsonBody(req);
    const name = normalizeText(body.name);
    const description = normalizeText(body.description).slice(0, 260);
    const locality = normalizeText(body.locality);
    const games = sanitizeStringArray(body.games, 10);
    if (!name || !locality || games.length === 0) {
      sendError(res, 400, "name, locality and at least one game are required");
      return;
    }
    const timestamp = nowISO();
    const community = {
      id: nextId("community"),
      name,
      description,
      locality,
      games,
      organizerId: auth.user.id,
      memberIds: [auth.user.id],
      verified: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.communities.push(community);
    notifyUsers(
      store,
      listAdminIds(store),
      "community_verification_pending",
      `Community "${name}" is waiting for verification`,
      { communityId: community.id }
    );
    writeStore(store);
    sendJson(res, 201, { message: "Community created", community: buildCommunityPayload(store, community, auth.user.id) });
    return;
  }

  const communityJoinMatch = pathname.match(/^\/api\/communities\/([^/]+)\/join$/);
  if (communityJoinMatch && req.method === "POST") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const communityId = decodeURIComponent(communityJoinMatch[1]);
    const community = store.communities.find((entry) => entry.id === communityId);
    if (!community) {
      sendError(res, 404, "Community not found");
      return;
    }
    if (!community.memberIds.includes(auth.user.id)) {
      community.memberIds.push(auth.user.id);
      community.updatedAt = nowISO();
      notifyUsers(store, [community.organizerId], "community_member_joined", `${auth.user.name} joined ${community.name}`, {
        communityId: community.id
      });
      writeStore(store);
    }
    sendJson(res, 200, { message: "Joined community", community: buildCommunityPayload(store, community, auth.user.id) });
    return;
  }

  const communityLeaveMatch = pathname.match(/^\/api\/communities\/([^/]+)\/leave$/);
  if (communityLeaveMatch && req.method === "POST") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const communityId = decodeURIComponent(communityLeaveMatch[1]);
    const community = store.communities.find((entry) => entry.id === communityId);
    if (!community) {
      sendError(res, 404, "Community not found");
      return;
    }
    if (community.organizerId === auth.user.id) {
      sendError(res, 400, "Organizer cannot leave community. Assign a new organizer first.");
      return;
    }
    community.memberIds = community.memberIds.filter((memberId) => memberId !== auth.user.id);
    community.updatedAt = nowISO();
    writeStore(store);
    sendJson(res, 200, { message: "Left community", community: buildCommunityPayload(store, community, auth.user.id) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/community-sessions") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const sessions = store.communitySessions
      .map((session) => {
        const community = store.communities.find((entry) => entry.id === session.communityId);
        const createdBy = store.users.find((entry) => entry.id === session.createdBy);
        const participants = (session.participantIds || [])
          .map((participantId) => store.users.find((entry) => entry.id === participantId))
          .filter(Boolean)
          .map((entry) => ({ id: entry.id, name: entry.name }));
        const slots = Number(session.slots || 0);
        return {
          ...session,
          communityName: community ? community.name : "Unknown",
          createdByName: createdBy ? createdBy.name : "Unknown",
          joined: (session.participantIds || []).includes(auth.user.id),
          slotsLeft: slots > 0 ? Math.max(0, slots - (session.participantIds || []).length) : null,
          participants
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sendJson(res, 200, { sessions });
    return;
  }

  if (req.method === "POST" && pathname === "/api/community-sessions") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const body = await readJsonBody(req);
    const communityId = normalizeText(body.communityId);
    const game = normalizeText(body.game);
    const location = normalizeText(body.location);
    const day = normalizeText(body.day);
    const time = normalizeText(body.time);
    const recurring = normalizeText(body.recurring);
    const slots = Number(body.slots || 0);

    if (!communityId || !game || !location || !day || !time) {
      sendError(res, 400, "communityId, game, location, day, and time are required");
      return;
    }
    const community = store.communities.find((entry) => entry.id === communityId);
    if (!community) {
      sendError(res, 404, "Community not found");
      return;
    }
    if (!community.memberIds.includes(auth.user.id)) {
      sendError(res, 403, "Join the community before posting sessions");
      return;
    }
    const timestamp = nowISO();
    const session = {
      id: nextId("session"),
      communityId,
      createdBy: auth.user.id,
      game,
      location,
      day,
      time,
      recurring: recurring || "none",
      slots: Number.isFinite(slots) && slots > 0 ? Math.min(slots, 50) : 0,
      participantIds: [auth.user.id],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.communitySessions.push(session);
    notifyUsers(
      store,
      community.memberIds.filter((memberId) => memberId !== auth.user.id),
      "community_session_posted",
      `${auth.user.name} posted a ${game} session in ${community.name}`,
      { sessionId: session.id, communityId }
    );
    writeStore(store);
    sendJson(res, 201, { message: "Session posted", session });
    return;
  }

  const sessionJoinMatch = pathname.match(/^\/api\/community-sessions\/([^/]+)\/join$/);
  if (sessionJoinMatch && req.method === "POST") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    const sessionId = decodeURIComponent(sessionJoinMatch[1]);
    const session = store.communitySessions.find((entry) => entry.id === sessionId);
    if (!session) {
      sendError(res, 404, "Session not found");
      return;
    }
    const community = store.communities.find((entry) => entry.id === session.communityId);
    if (!community) {
      sendError(res, 404, "Community not found for this session");
      return;
    }
    if (!community.memberIds.includes(auth.user.id)) {
      sendError(res, 403, "Join the community before joining sessions");
      return;
    }
    if (!Array.isArray(session.participantIds)) {
      session.participantIds = [];
    }
    if (!session.participantIds.includes(auth.user.id)) {
      if (session.slots > 0 && session.participantIds.length >= session.slots) {
        sendError(res, 400, "Session is full");
        return;
      }
      session.participantIds.push(auth.user.id);
      session.updatedAt = nowISO();
      notifyUsers(store, [session.createdBy], "session_joined", `${auth.user.name} joined your ${session.game} session`, {
        sessionId
      });
      writeStore(store);
    }
    sendJson(res, 200, { message: "Joined session", session });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/overview") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const kpis = computeGlobalKpis(store);
    const openReports = store.reports.filter((entry) => entry.status === "open").length;
    const pendingCommunities = store.communities.filter((entry) => !entry.verified).length;
    const recentActivity = store.notifications
      .slice(-30)
      .reverse()
      .map((entry) => ({
        id: entry.id,
        type: entry.type,
        message: entry.message,
        createdAt: entry.createdAt
      }));
    sendJson(res, 200, {
      kpis: {
        ...kpis,
        openReports,
        pendingCommunities
      },
      recentActivity
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/users") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const users = store.users.map((user) => {
      const requestCount = store.playRequests.filter(
        (entry) => entry.fromUserId === user.id || entry.toUserId === user.id
      ).length;
      return {
        ...toPublicUser(user),
        requestCount
      };
    });
    sendJson(res, 200, { users });
    return;
  }

  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (adminUserMatch && req.method === "PATCH") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const userId = decodeURIComponent(adminUserMatch[1]);
    const target = store.users.find((entry) => entry.id === userId);
    if (!target) {
      sendError(res, 404, "User not found");
      return;
    }
    const body = await readJsonBody(req);
    if (body.isActive !== undefined) {
      target.isActive = Boolean(body.isActive);
      if (!target.isActive) {
        store.sessions = store.sessions.filter((session) => session.userId !== target.id);
      }
    }
    if (body.role !== undefined) {
      const role = normalizeLower(body.role);
      if (["user", "organizer", "admin"].includes(role)) {
        target.role = role;
      }
    }
    target.updatedAt = nowISO();
    notifyUsers(store, [target.id], "account_updated", "Your account settings were updated by admin", {
      userId: target.id
    });
    writeStore(store);
    sendJson(res, 200, { message: "User updated", user: toPublicUser(target) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/games") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const body = await readJsonBody(req);
    const name = normalizeText(body.name);
    const category = normalizeText(body.category) || "Indoor";
    if (!name) {
      sendError(res, 400, "Game name is required");
      return;
    }
    const exists = store.games.some((entry) => normalizeLower(entry.name) === normalizeLower(name));
    if (exists) {
      sendError(res, 409, "Game already exists");
      return;
    }
    const id = `game_${normalizeLower(name).replace(/[^a-z0-9]+/g, "_")}`;
    const game = { id, name, category };
    store.games.push(game);
    writeStore(store);
    sendJson(res, 201, { message: "Game category added", game });
    return;
  }

  const verifyCommunityMatch = pathname.match(/^\/api\/admin\/communities\/([^/]+)\/verify$/);
  if (verifyCommunityMatch && req.method === "PATCH") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const communityId = decodeURIComponent(verifyCommunityMatch[1]);
    const community = store.communities.find((entry) => entry.id === communityId);
    if (!community) {
      sendError(res, 404, "Community not found");
      return;
    }
    const body = await readJsonBody(req);
    community.verified = Boolean(body.verified);
    community.updatedAt = nowISO();
    notifyUsers(
      store,
      [community.organizerId],
      "community_verification_updated",
      `Community "${community.name}" verification is now ${community.verified ? "approved" : "pending"}`,
      { communityId }
    );
    writeStore(store);
    sendJson(res, 200, { message: "Community verification updated", community });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/reports") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const reports = store.reports
      .map((report) => {
        const reporter = store.users.find((entry) => entry.id === report.reportedBy);
        return {
          ...report,
          reporterName: reporter ? reporter.name : "Unknown"
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    sendJson(res, 200, { reports });
    return;
  }

  const reportMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)$/);
  if (reportMatch && req.method === "PATCH") {
    const auth = requireAuth(store, req, res, urlObj);
    if (!auth) {
      return;
    }
    if (!isAdmin(auth.user)) {
      sendError(res, 403, "Admin access required");
      return;
    }
    const reportId = decodeURIComponent(reportMatch[1]);
    const report = store.reports.find((entry) => entry.id === reportId);
    if (!report) {
      sendError(res, 404, "Report not found");
      return;
    }
    const body = await readJsonBody(req);
    const status = normalizeLower(body.status);
    if (!["open", "resolved", "dismissed"].includes(status)) {
      sendError(res, 400, "Invalid report status");
      return;
    }
    report.status = status;
    report.actionNote = normalizeText(body.actionNote).slice(0, 240);
    report.updatedAt = nowISO();
    writeStore(store);
    sendJson(res, 200, { message: "Report updated", report });
    return;
  }

  sendError(res, 404, "API route not found");
}

function serveStatic(res, pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(target).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendError(res, 404, "Not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(urlObj.pathname);
  const store = readStore();
  cleanupExpiredSessions(store);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      Allow: "GET, POST, PUT, PATCH, OPTIONS"
    });
    res.end();
    return;
  }

  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, urlObj, pathname, store);
    } else {
      serveStatic(res, pathname);
    }
  } catch (error) {
    const message = error && error.message ? error.message : "Unexpected server error";
    sendError(res, 500, message);
  } finally {
    writeStore(store);
  }
});

server.listen(PORT, () => {
  console.log(`Local Sports Partner Finder running on http://localhost:${PORT}`);
});
