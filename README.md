# Airbnb Lab 1 — (React + Node/Express + MySQL + FastAPI Agent)

Monorepo with Docker Compose for fast bring-up.

## Quick Start (Docker)

```bash
docker compose up --build
```

Services:
- MySQL: `localhost:3306` (db: `airbnb`, user: `airbnb`, pass: `airbnbpassword`)
- Backend (Express): `http://localhost:3001`
- Agent (FastAPI): `http://localhost:8000`
- Frontend (Vite React): `http://localhost:5173`

The DB will auto-init with tables and two demo users:
- Owner: `owner@example.com` / `password123`
- Traveler: `traveler@example.com` / `password123`

> Sessions are cookie-based. Frontend is configured to send credentials.

## Manual Dev (without Docker)

### 1) Database
- Install MySQL 8.x and create a DB `airbnb`.
- Run `scripts/init_db.sql` to create tables.

### 2) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3) Agent
```bash
cd agent
python -m venv .venv && source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4) Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```

Set environment variables if needed:
- Backend: `CORS_ORIGIN`, `SESSION_SECRET`, `FILE_BASE_URL`
- Agent: `TAVILY_API_KEY` (optional for web search enrichment)

## Features Coverage

- Traveler: signup/login/logout, profile CRUD + avatar, property search, booking create/list, favorites, history (via bookings list).
- Owner: signup/login/logout, property posting, my properties list, booking management (accept/cancel), dashboard stats.
- Backend APIs: RESTful, session-based auth, validation, error responses.
- Frontend: responsive Tailwind layout, Axios calls, dashboards, agent button UI.
- Agent: FastAPI endpoint creates trip plan, activities, restaurants, checklist; optional Tavily enrichment.
- API Docs: Postman collection in `/postman`.

