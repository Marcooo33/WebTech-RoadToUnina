# ROADTOUNINA

Full-stack web project for the Web Technologies course at Università degli Studi di Napoli Federico II.

## Repository structure

```
roadtounina/
├── frontend/    # Angular frontend (standalone, routing, CSS)
├── backend/     # Node.js + Express + TypeScript API, Prisma ORM
├── docs/        # Project documentation
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js >= 20
- npm
- Angular CLI (installed locally per project via `frontend/package.json`)
- A PostgreSQL database hosted on Supabase (credentials go in `backend/.env`)

## Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Run the frontend

```bash
cd frontend
npm start
```

The app is served at http://localhost:4200.

## Run the backend

```bash
cd backend
cp .env.example .env   # fill in your Supabase credentials
npm run dev
```

The API is served at http://localhost:3000 (health check: http://localhost:3000/health).
