# Student Service

This service wraps the existing OutSystems Student REST API and exposes a Teamder-controlled backend endpoint using Flask.

## Base URL

`http://localhost:3001`

## Routes

- `GET /health`
- `GET /api/students`
- `GET /api/students/:studentId`
- `POST /api/students`
- `PUT /api/students/:studentId`
- `DELETE /api/students/:studentId`
- `POST /api/students/bulk-info`

## Environment variables

- `PORT`: local port for this service
- `OUTSYSTEMS_BASE_URL`: upstream OutSystems Student API base URL

## Notes

The folder is currently named `studentServicee` because that is what already exists in the repo. It can be renamed to `studentService` later if you want cleaner naming.

You have to run
docker compose up --build student-service
[try out this link](http://localhost:3001/api/students)
