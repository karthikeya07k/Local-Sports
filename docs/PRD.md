# Product Requirements Document (PRD)

## Product Name

Local Sports & Indoor Games Partner Finder Platform

## Problem Statement

People struggle to find suitable local partners for casual indoor/outdoor games because discovery is fragmented across informal channels and manual coordination.

## Primary Objectives

- Enable users to find nearby game partners quickly
- Encourage healthy recreational activity
- Strengthen local community interaction
- Reduce effort to coordinate game sessions

## Secondary Objectives

- Increase recurring participation rates
- Support multiple games and skill levels
- Scale to neighborhoods, communities, and cities

## Target Users

- Individual players (beginner, intermediate, advanced)
- Women-focused and inclusive community participants
- Local community organizers
- Platform administrators

## Scope

### In Scope

- Responsive web application
- Profile-based partner discovery
- Play requests and confirmation flow
- Community groups and open sessions
- Admin dashboard with moderation controls

### Out of Scope (Phase 1)

- Native mobile apps
- Tournament scoring systems
- Paid coaching/training marketplace
- In-app calling/chat

## Core User Stories

1. As a user, I can register/login and create my profile.
2. As a user, I can set games, skill level, availability, and preferred locations.
3. As a user, I can search nearby players by game/location/time/skill.
4. As a user, I can send requests and receive accept/decline updates in real-time.
5. As a user, I can view my match/play history.
6. As an organizer, I can create community groups and post open sessions.
7. As an admin, I can manage users, game categories, reports, and community verification.

## Functional Requirements

### User Module

- Registration and login
- Profile management
- Game preference selection
- Availability scheduling
- Location preferences: home, society clubhouse, local ground
- Partner discovery with filters
- Play request send/receive
- Request status management
- Play history

### Community Module (Optional but Included)

- Community creation
- Join/leave community
- Open play session posting
- Recurring session flags

### Admin Module

- View platform KPIs
- Manage users (status, role)
- Add/manage game categories
- Review misuse reports
- Verify communities

### Onboarding Module

- Guided setup for first-time users
- Game selection, schedule setup, skill and profile completion

## Non-Functional Requirements

- Search and matchmaking response target: under 3 seconds
- Secure auth and hashed password storage
- Intuitive UX for mixed age groups
- Scalable architecture for data and user growth

## KPIs

- Registered users
- Active play requests
- Successful match rate
- Monthly active users
- Repeat engagement rate

## Assumptions

- Users provide valid location and availability data
- Usage is casual and community-friendly
- Community participation is voluntary

## Constraints

- No native app in phase 1
- No in-app chat in phase 1
- Limited moderation automation in phase 1

## Deliverables Mapping

- Functional web app: implemented
- Admin dashboard: implemented
- Player onboarding module: implemented
- PRD + technical docs: implemented
- Deployment-ready build: included via Node start script
