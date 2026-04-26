<<<<<<< HEAD
# Local-Sports
=======
# Local Sports & Indoor Games Partner Finder Platform

A real-time, community-first web platform to discover and connect with nearby partners for indoor and outdoor games such as chess, carrom, cards, badminton, table tennis, and more.

## Implemented Scope

- Responsive web platform (desktop + mobile)
- User registration/login with secure password hashing
- JWT-based authentication and protected API routes
- Personal profile management
- Coordinate-based user location (`lat/lng`)
- Preferred games, skill level, and availability slots
- Nearby search with radius filtering (km), game, skill, and schedule
- Send/receive play requests with accept/decline/cancel
- Match/play history
- Community creation, joining, and open session posting
- Admin dashboard:
  - User management
  - Game category management
  - Community verification
  - Misuse report handling
- Real-time updates with Server-Sent Events (SSE)
- Player onboarding module

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js (`http` module, no external dependencies)
- Storage: JSON file datastore (`data/store.json`)
- Realtime: Server-Sent Events (`/api/events`)

## Project Structure

```text
SPORTS/
  data/
    store.json
  docs/
    PRD.md
    TECHNICAL_DOCUMENTATION.md
  public/
    index.html
    styles.css
    app.js
  package.json
  server.js
```

## Run Locally

```bash
npm start
```

Open:

- [http://localhost:3000](http://localhost:3000)

## Default Notes

- The app supports three roles at registration: `user`, `organizer`, `admin`.
- Admin registration requires code: `SPORTS_ADMIN_2026`.
- Data is persisted in `data/store.json`.

## Key API Endpoints

- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Profile & onboarding:
  - `GET /api/me`
  - `PUT /api/profile`
  - `POST /api/onboarding`
- Matchmaking:
  - `GET /api/players/search`
  - `POST /api/requests`
  - `GET /api/requests`
  - `PATCH /api/requests/:id`
  - `GET /api/history`
- Communities:
  - `GET /api/communities`
  - `POST /api/communities`
  - `POST /api/communities/:id/join`
  - `POST /api/community-sessions`
  - `GET /api/community-sessions`
- Admin:
  - `GET /api/admin/overview`
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id`
  - `POST /api/admin/games`
  - `PATCH /api/admin/communities/:id/verify`
  - `GET /api/admin/reports`
  - `PATCH /api/admin/reports/:id`
- Realtime:
  - `GET /api/events?token=<token>`
>>>>>>> 07a1dda (Initial commit)
