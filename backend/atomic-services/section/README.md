# Section Service

This service exposes a Teamder-controlled atomic CRUD API for sections backed by Supabase.

## Base URL

`http://localhost:3018/section`

## Routes

- `GET /health`
- `GET /section`
- `GET /section/:sectionId`
- `POST /section`
- `PUT /section/:sectionId`
- `DELETE /section/:sectionId`

## Query params

- `course_id`
- `is_active`

## Database

Schema: `section`
Table: `section`

Expected columns:
- `id uuid primary key`
- `section_number int8 not null`
- `course_id int8 not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Environment variables

- `PORT`
- `SUPABASE_URL`

Run with:
`docker compose up --build section-service`
