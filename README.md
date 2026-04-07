# TeamderESD

Teamder is a microservices-based team formation system.

## Project Structure

```text
TeamderESD/
├─ frontend/   # React + Vite frontend
└─ backend/    # Flask and microservices backend
```

## Prerequisites

- Node.js and npm
- Docker Desktop

## Frontend Startup

From the `frontend` folder:

```bash
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

Useful routes:

- `/` - home page
- `/test` - developer component gallery

## Backend Startup

From the `backend` folder:

```bash
docker compose up -d --build
```

Backend student service runs at:

```text
http://localhost:3001
```

Useful backend routes:

- `/health`
- `/api/students`
- `/api/students/:studentId`
- `/api/students/bulk-info`

Example:

```text
http://localhost:3001/api/students
```

## Recommended Startup Order

1. Start the backend from `backend/`
2. Start the frontend from `frontend/`
3. Open the frontend in the browser
4. Test backend endpoints separately if needed

## Notes

- The current `studentServicee` backend service is a Flask wrapper around an existing OutSystems Student API.
- The frontend currently includes a `/test` gallery page for developers to inspect migrated UI components before using them in real pages.
