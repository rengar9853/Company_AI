# Full ChatGPT Web App (Self-Hosted)

This repository contains a full-stack ChatGPT-style web application with:
- React frontend
- Node/Express backend
- MySQL persistence
- Local file storage (default: `./data/uploads`, configurable)
- OpenAI Responses API integration with tools

## Structure
- `backend/` Express API server
- `frontend/` React client (Vite)
- `nginx/` Reverse proxy config
- `docker-compose.yml` Local/self-hosted stack
- `data/uploads/` Local file storage (mounted)

## Quick Start (Development)
1. Copy backend env:
   - `backend/.env.example` -> `backend/.env`
2. Start services:
   - `docker compose up -d mysql redis nginx`
3. Start backend:
   - `cd backend`
   - `npm install`
   - `npm run dev`
4. Start frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Notes
- Admin account is auto-seeded on backend startup if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.
- File uploads are stored locally and indexed to OpenAI vector stores when an API key is provided.
