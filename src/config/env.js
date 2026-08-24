const REQUIRED_RUNTIME = [
    'NODE_ENV', 'API_VERSION', 'MONGO_URI', 'JWT_SECRET',
    'JWT_REFRESH_SECRET', 'ALLOWED_ORIGINS', 'FRONTEND_URL', 'QUEUE_DRIVER'
];

const REQUIRED_PRODUCTION = [
    'BACKEND_URL', 'JWT_EXPIRE', 'JWT_REFRESH_EXPIRE', 'RESEND_API_KEY',
    'MAIL_FROM', 'QUEUE_CONCURRENCY', 'QUEUE_STRICT', 'USE_MEMORY_REDIS',
    'LOG_LEVEL', 'UPLOAD_PATH', 'MAX_FILE_SIZE', 'ALLOWED_FILE_TYPES'
];

const insecureSecrets = new Set([
    'your_jwt_secret_key',
    'your_jwt_refresh_secret_key',
    'change-me'
]);

const assertUrl = (name, protocols, requireHttps = false) => {
    let url;
    try {
        url = new URL(process.env[name]);
    } catch {
        throw new Error(`${name} must be a valid URL`);
    }

    if (!protocols.includes(url.protocol)) {
        throw new Error(`${name} must use ${protocols.join(' or ')}`);
    }
    if (requireHttps && url.protocol !== 'https:') {
        throw new Error(`${name} must use HTTPS in production`);
    }
};

const assertPositiveInteger = (name) => {
    const value = Number(process.env[name]);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
};

const validateEnvironment = () => {
    const environment = process.env.NODE_ENV;
    if (!['development', 'test', 'production'].includes(environment)) {
        throw new Error('NODE_ENV must be development, test, or production');
    }

    // Jest provides isolated dependencies and values in its setup file.
    if (environment === 'test') return;

    const required = environment === 'production'
        ? [...REQUIRED_RUNTIME, ...REQUIRED_PRODUCTION]
        : REQUIRED_RUNTIME;
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (!/^v\d+$/.test(process.env.API_VERSION)) {
        throw new Error('API_VERSION must use the format v1, v2, and so on');
    }

    assertUrl('MONGO_URI', ['mongodb:', 'mongodb+srv:']);
    assertUrl('FRONTEND_URL', ['http:', 'https:'], environment === 'production');

    const origins = process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
    if (!origins.length || origins.some((origin) => !origin)) {
        throw new Error('ALLOWED_ORIGINS must contain at least one URL');
    }
    for (const origin of origins) {
        try {
            const url = new URL(origin);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
            if (environment === 'production' && url.protocol !== 'https:') throw new Error();
        } catch {
            throw new Error('Every ALLOWED_ORIGINS entry must be a valid HTTPS URL in production');
        }
    }

    for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const value = process.env[name];
        if (value.length < 32 || insecureSecrets.has(value.toLowerCase())) {
            throw new Error(`${name} must be a secure secret of at least 32 characters`);
        }
    }
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }

    const queueDriver = process.env.QUEUE_DRIVER;
    if (!['auto', 'bullmq', 'rabbitmq', 'memory'].includes(queueDriver)) {
        throw new Error('QUEUE_DRIVER must be auto, bullmq, rabbitmq, or memory');
    }
    if (queueDriver === 'bullmq' && !process.env.REDIS_URL?.trim()) {
        throw new Error('REDIS_URL is required when QUEUE_DRIVER=bullmq');
    }
    if (queueDriver === 'rabbitmq' && !process.env.RABBITMQ_URL?.trim()) {
        throw new Error('RABBITMQ_URL is required when QUEUE_DRIVER=rabbitmq');
    }
    if (process.env.REDIS_URL) assertUrl('REDIS_URL', ['redis:', 'rediss:']);
    if (process.env.RABBITMQ_URL) assertUrl('RABBITMQ_URL', ['amqp:', 'amqps:']);

    if (environment === 'production') {
        assertUrl('BACKEND_URL', ['https:']);
        assertPositiveInteger('QUEUE_CONCURRENCY');
        assertPositiveInteger('MAX_FILE_SIZE');

        if (!['true', 'false'].includes(process.env.QUEUE_STRICT)) {
            throw new Error('QUEUE_STRICT must be true or false');
        }
        if (!['true', 'false'].includes(process.env.USE_MEMORY_REDIS)) {
            throw new Error('USE_MEMORY_REDIS must be true or false');
        }
        if (!process.env.RESEND_API_KEY.startsWith('re_')) {
            throw new Error('RESEND_API_KEY must start with re_');
        }
        if (!/^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(process.env.MAIL_FROM)) {
            throw new Error('MAIL_FROM must use the format ChatApp <email@example.com>');
        }
        if (!process.env.UPLOAD_PATH.startsWith('/')) {
            throw new Error('UPLOAD_PATH must be an absolute path in production');
        }
    }
};

module.exports = validateEnvironment;
