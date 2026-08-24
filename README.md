# Chat App Backend

Production-oriented REST and Socket.IO backend for the Chat App. It provides
private and group messaging, authentication with refresh-token rotation, 2FA,
message search, uploads, presence, reactions, group administration, and
password-reset email jobs.

## Stack

- Node.js 20.19.x and Express 4
- MongoDB with Mongoose
- Socket.IO with an optional Redis adapter
- Redis for refresh tokens, token revocation, temporary 2FA state, and presence
- BullMQ with `ioredis`, optional RabbitMQ, and an in-process queue fallback
- JWT access tokens and an HttpOnly refresh-token cookie
- Jest and MongoDB Memory Server

## Local setup

```sh
nvm use 20.19.1
npm ci
cp .env.example .env
```

For local development, change `.env` to development URLs and provide MongoDB,
Redis, JWT, and Resend settings. Start the API with:

```sh
npm run dev
```

The default API prefix is `http://localhost:5000/api/v1`. Health status is
available at `/api/v1/health`.

## Queue drivers

The password-reset email is processed through the configured queue driver.

```text
QUEUE_DRIVER=bullmq   -> requires REDIS_URL; uses BullMQ + ioredis
QUEUE_DRIVER=rabbitmq -> requires RABBITMQ_URL; uses RabbitMQ
QUEUE_DRIVER=auto     -> BullMQ, then RabbitMQ, then in-process fallback
QUEUE_DRIVER=memory   -> immediate in-process processing
```

`QUEUE_STRICT=false` allows a broker connection failure to fall back to direct
processing. The fallback is not durable and should not be relied on for queued
work across restarts or multiple instances.

The application's Redis client also has an in-memory availability fallback.
That fallback does not preserve sessions or revocations across restarts and is
not appropriate for horizontally scaled production instances.

## Authentication

Successful registration and login return an access token. The refresh token is
stored in a `Secure`, `HttpOnly` cookie outside the test environment. Frontend
requests must send credentials. In production, `FRONTEND_URL` and every value
in `ALLOWED_ORIGINS` must use HTTPS.

Main route groups:

- `/api/v1/auth` — registration, login, refresh, logout, 2FA, profile, password reset
- `/api/v1/chat` — conversations, messages, search, edit/delete/pin, upload
- `/api/v1/group` — groups, members, admins, invitations, and join requests
- `/api/v1/users` — user search, mute, and block controls
- `/api/v1/upload` — authenticated file upload

## Verification

```sh
npm test
npm run test:coverage
npm audit --omit=dev
docker build -t chat-app-backend .
```

## Render deployment

This repository includes [render.yaml](render.yaml) and a production
[Dockerfile](Dockerfile). Create a Render Blueprint from this repository and
provide the secret environment values requested by the Blueprint. The default
deployment uses `QUEUE_DRIVER=bullmq`, so it requires a managed `REDIS_URL`.

Uploads use the persistent disk path `/var/data/uploads`. See
[DEPLOYMENT.md](DEPLOYMENT.md) for Render configuration and RabbitMQ switching.

Do not commit `.env`, credentials, reset tokens, or generated uploads.
