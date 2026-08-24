const requiredInProduction = [
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ALLOWED_ORIGINS',
    'FRONTEND_URL',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'MAIL_FROM'
];

const insecureSecrets = new Set([
    'your_jwt_secret_key',
    'your_jwt_refresh_secret_key',
    'change-me'
]);

const validateEnvironment = () => {
    if (process.env.NODE_ENV !== 'production') return;

    const missing = requiredInProduction.filter((name) => !process.env[name]?.trim());
    if (missing.length) {
        throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }

    for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const value = process.env[name];
        if (value.length < 32 || insecureSecrets.has(value)) {
            throw new Error(`${name} must be a unique secret of at least 32 characters`);
        }
    }

    const origins = process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
    if (origins.some((origin) => !origin.startsWith('https://'))) {
        throw new Error('Every production ALLOWED_ORIGINS value must use HTTPS');
    }

    const queueDriver = process.env.QUEUE_DRIVER || 'auto';
    if (queueDriver === 'bullmq' && !process.env.REDIS_URL) {
        throw new Error('REDIS_URL is required when QUEUE_DRIVER=bullmq');
    }
    if (queueDriver === 'rabbitmq' && !process.env.RABBITMQ_URL) {
        throw new Error('RABBITMQ_URL is required when QUEUE_DRIVER=rabbitmq');
    }
};

module.exports = validateEnvironment;
