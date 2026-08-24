# Render deployment

Create a Render Blueprint from this backend repository. Render detects the
repository-level `render.yaml` and builds the included `Dockerfile`.

Provide every environment value marked `sync: false`. For the default queue:

```text
QUEUE_DRIVER=bullmq
REDIS_URL=rediss://username:password@redis-host:6379
FRONTEND_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app
RESEND_API_KEY=re_your_api_key
MAIL_FROM=ChatApp <no-reply@your-verified-domain.com>
```

`MAIL_FROM` must use a sending domain verified in your Resend account. Keep the
API key only in Render's environment settings; never commit it to the repository.

To switch to RabbitMQ later, set:

```text
QUEUE_DRIVER=rabbitmq
RABBITMQ_URL=amqps://username:password@rabbitmq-host/vhost
```

With `QUEUE_DRIVER=auto`, Redis/BullMQ is preferred, RabbitMQ is second, and
jobs run immediately in-process when neither broker URL exists. In-process mode
is not durable.

The Blueprint mounts a persistent disk at `/var/data`; uploads use
`/var/data/uploads`. After deployment, verify `/api/v1/health`, login, token
refresh, Socket.IO messaging, uploads, and password-reset email delivery.
