# CampusHub — Complete GitHub-Ready Full-Stack Website

This is the upgraded CampusHub website based on the original prototype. It includes the frontend, backend API, authentication, event management, registrations, questions/replies, data storage and deployment configuration.

## Folder structure

```text
CampusHub/
├── public/
│   └── index.html
├── data/
│   └── db.json
├── server.js
├── package.json
├── render.yaml
├── .env.example
├── .gitignore
└── README.md
```

## Run locally

Node.js 18+ is recommended.

```bash
npm start
```

No external npm packages are required. Then open:

`http://localhost:3000`

## Demo login

Student: `STUDENT01` / `student123`

Faculty: `FACULTY01` / `genx123`

## Main API routes

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/me`
- `GET /api/events`
- `POST /api/events` (faculty)
- `PATCH /api/events/:id` (faculty)
- `DELETE /api/events/:id` (faculty)
- `GET /api/stats`
- `GET /api/registrations`
- `POST /api/events/:id/register`
- `DELETE /api/events/:id/register`
- `GET /api/queries`
- `POST /api/queries`
- `PATCH /api/queries/:id` (faculty)

## GitHub deployment

Upload the entire repository to GitHub. GitHub is the source-code host; it does not run `server.js`.

For a public working website, deploy the repository to a Node-compatible host such as Render. `render.yaml` is included for that purpose. The frontend and API are served from the same host, so the login request no longer points to a missing backend.

### Why GitHub Pages alone will not work

GitHub Pages only serves static files and cannot execute the Node.js backend. If you deploy this exact full-stack version on GitHub Pages, API login will fail. Use a Node-compatible host for the full-stack version.

## Prototype database

`data/db.json` is intentionally simple so the project can run without PostgreSQL. It is suitable for a hackathon prototype or single-server demo. For production, use PostgreSQL/Supabase or another managed database and managed authentication.
