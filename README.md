# VELORA — Intelligent Task & Productivity Workspace
Express + MongoDB (Mongoose) API with a React (Vite) client.

## Features
Register/login (bcrypt, JWT in HTTP-only cookie), per-user task CRUD, status changes, search, filters, sorting, list and board views,
categories (defaults seeded, delete keeps tasks), dashboard stats computed from the database, 7-day completion chart.

## Run locally
Requires Node 20+ and MongoDB.
```
cp .env.example server/.env      # set JWT_SECRET
cd server && npm install && npm run dev
cd client && npm install && npm run dev    # http://localhost:5173 (proxies /api to :4000)
```
Production: `cd client && npm run build`, serve `client/dist` behind the same origin as the API (or set CLIENT_ORIGIN and NODE_ENV=production), `cd server && npm start`.

## API (all except auth require the session cookie)
POST /api/auth/register | login | logout, GET /api/auth/me
GET/POST /api/tasks, GET/PATCH/DELETE /api/tasks/:id  (query: q,status,priority,category,overdue=1,sort=due|created|updated|title)
GET/POST /api/categories, DELETE /api/categories/:id
GET /api/dashboard/summary

## Security notes
Every task/category query is scoped by the authenticated userId; inputs validated with Zod (no mass assignment); auth endpoints rate limited.

## Known limitations
Not implemented: calendar, Today/Upcoming pages, analytics page, notifications, profile/settings, password reset, drag-and-drop, priority sorting, automated tests.
Dashboard days are bucketed in UTC. The API was not run against a live MongoDB in the build environment.
