# Technical Documentation

## 1. Architecture Overview

The platform is a single-service Node.js web application with:

- HTTP API server (`server.js`)
- Static client app (`public/index.html`, `public/app.js`, `public/styles.css`)
- File-based datastore (`data/store.json`)
- Real-time notifications via SSE (`/api/events`)

## 2. Modules

### 2.1 Authentication

- Password hashing: PBKDF2 (`sha512`, 120k iterations, per-user salt)
- Session management: JWT (`Bearer <token>`) with signed/expiring tokens
- Session TTL: 14 days
- Auth endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`

### 2.2 User Profile + Onboarding

- Core profile fields:
  - `name`, `city`, `area`, `bio`
  - `coordinates` (`lat`, `lng`)
  - `preferredGames[]`
  - `skillLevel`
  - `preferredLocations[]`
  - `availability[]` (`day`, `start`, `end`)
- Endpoints:
  - `GET /api/me`
  - `PUT /api/profile`
  - `POST /api/onboarding`

### 2.3 Matchmaking

- Filter dimensions:
  - game type
  - geographic origin (`lat`, `lng`)
  - radius (`radiusKm`)
  - optional location keyword
  - day/time availability
  - skill level
- Candidate scoring:
  - common game overlap
  - requested game match
  - location match
  - geospatial proximity (distance in km)
  - schedule overlap
  - city/area affinity
- Endpoints:
  - `GET /api/players/search`
  - `POST /api/requests`
  - `GET /api/requests`
  - `PATCH /api/requests/:id`
  - `GET /api/history`

### 2.4 Community & Organizer

- Community lifecycle:
  - create community
  - join/leave
  - verify by admin
- Session lifecycle:
  - post open session
  - join session
  - recurring metadata
- Endpoints:
  - `GET /api/communities`
  - `POST /api/communities`
  - `POST /api/communities/:id/join`
  - `POST /api/communities/:id/leave`
  - `GET /api/community-sessions`
  - `POST /api/community-sessions`
  - `POST /api/community-sessions/:id/join`

### 2.5 Admin Dashboard

- KPI tracking:
  - registered users
  - active play requests
  - successful match rate
  - monthly active users
  - repeat engagement rate
  - open reports
  - pending communities
- Admin actions:
  - user status/role updates
  - add game category
  - verify communities
  - process reports
- Endpoints:
  - `GET /api/admin/overview`
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id`
  - `POST /api/admin/games`
  - `PATCH /api/admin/communities/:id/verify`
  - `GET /api/admin/reports`
  - `PATCH /api/admin/reports/:id`

### 2.6 Misuse Reporting

- Any authenticated user can submit reports
- Reports are reviewed by admins
- Endpoint:
  - `POST /api/reports`

### 2.7 Real-Time Layer

- Transport: Server-Sent Events (SSE)
- Endpoint:
  - `GET /api/events?token=<token>`
- Event triggers:
  - play request created/updated
  - community/session events
  - moderation/report events
- Frontend behavior:
  - live toast notifications
  - selective dashboard/module refreshes
  - periodic polling fallback every 8 seconds

## 3. Data Model

### 3.1 `users`

- `id`, `name`, `email`
- `passwordSalt`, `passwordHash`
- `role` (`user` | `organizer` | `admin`)
- `city`, `area`, `bio`
- `coordinates` (`lat`, `lng`)
- `preferredGames[]`, `preferredLocations[]`
- `skillLevel`, `availability[]`
- `onboardingCompleted`, `isActive`
- timestamps

### 3.2 `sessions`

- `id`, `token`, `userId`
- `createdAt`, `expiresAt`

### 3.3 `games`

- `id`, `name`, `category`

### 3.4 `playRequests`

- `id`, `fromUserId`, `toUserId`
- `game`, `location`, `day`, `time`, `message`
- `status` (`pending` | `accepted` | `declined` | `cancelled`)
- timestamps

### 3.5 `communities`

- `id`, `name`, `description`, `locality`
- `games[]`, `organizerId`, `memberIds[]`
- `verified`
- timestamps

### 3.6 `communitySessions`

- `id`, `communityId`, `createdBy`
- `game`, `location`, `day`, `time`
- `recurring`, `slots`, `participantIds[]`
- timestamps

### 3.7 `reports`

- `id`, `reportedBy`
- `targetType`, `targetId`
- `reason`, `details`
- `status` (`open` | `resolved` | `dismissed`)
- timestamps

### 3.8 `notifications`

- `id`, `userId`, `type`, `message`
- `data` payload
- `read`, `createdAt`

## 4. Security Notes

- Passwords are not stored in plain text
- Timing-safe password comparison used
- JWT signature verification, expiry checks, and server-side logout invalidation implemented
- Role-based authorization checks on admin routes
- Input sanitization and length limits for key fields

## 5. Performance Notes

- In-memory filtering over JSON store for rapid reads
- Lightweight payloads and targeted UI refresh calls
- SSE avoids polling for request updates and status changes

## 6. Deployment Notes

- Start command: `npm start`
- Default port: `3000` (override with `PORT`)
- Works in low-dependency environments without external package install

## 7. Future Enhancements

- PostgreSQL/MongoDB migration
- WebSocket upgrade for richer collaboration
- In-app messaging and chat
- Ratings/reviews
- AI-based partner recommendations
- Geospatial distance matching with maps API
