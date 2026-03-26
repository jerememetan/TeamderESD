# Course Service

This service wraps the existing OutSystems Course REST API and exposes a Teamder-controlled backend endpoint using Flask.

## Base URL

`http://localhost:3017`

## Routes

- `GET /health`
- `GET /api/courses`
- `GET /api/courses/:courseId`
- `POST /api/courses`
- `PUT /api/courses/:courseId`
- `DELETE /api/courses/:courseId`

## Environment variables

- `PORT`: local port for this service
- `OUTSYSTEMS_BASE_URL`: upstream OutSystems Course API base URL

## Notes

Default upstream:
`https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course`

Run with:
`docker compose up --build course-service`

Try:
`http://localhost:3017/api/courses`
