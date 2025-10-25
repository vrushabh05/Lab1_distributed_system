# Lab 1 Report — Airbnb Prototype with Agentic AI

## Introduction
Goal: Build a two‑persona Airbnb-like system (Traveler, Owner) with React frontend, Node/Express/MySQL backend, and a Python FastAPI concierge agent.

## System Design
- **Frontend**: React + Vite + Tailwind, Axios for REST, session cookies.
- **Backend**: Express, MySQL, express-session + MySQL store, REST endpoints.
- **DB**: `users`, `properties`, `bookings`, `favorites`, `sessions` tables.
- **Agent**: FastAPI service exposing `/agent/plan`, optional Tavily search.

## Key Screens (add screenshots)
<!-- Add: Login, Signup, Search, Property Details, Booking Flow, Favorites, Traveler Bookings, Owner Dashboard, Post Property -->
<!-- Screenshot placeholders -->

## API Tests (Postman)
Use `/postman/AirBnBLab1.postman_collection.json`.

## Results
- Traveler can search, book, manage favorites/history.
- Owner can post properties, accept/cancel bookings, see dashboard stats.
- Agent provides itinerary and suggestions integrated via UI button.

## Conclusion
All required features implemented with clean separation of concerns and extensible architecture.
