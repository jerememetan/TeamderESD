# Teamder Backend

This backend is organized around microservices.

## Current services

- `atomic-services/studentServicee`: Flask wrapper service for the existing OutSystems Student API

## Run locally

```bash
docker compose up --build student-service
```

The service will be available at `http://localhost:3001`.

## Why this service exists

The Student CRUD logic already exists in OutSystems. This service gives Teamder a backend-owned API layer so the frontend does not depend directly on the external system.
