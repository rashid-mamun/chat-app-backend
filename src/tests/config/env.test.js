const validateEnvironment = require('../../config/env');

const validProductionEnv = {
    NODE_ENV: 'production',
    API_VERSION: 'v1',
    BACKEND_URL: 'https://api.example.com',
    FRONTEND_URL: 'https://app.example.com',
    ALLOWED_ORIGINS: 'https://app.example.com',
    MONGO_URI: 'mongodb+srv://user:password@example.mongodb.net/chatapp',
    REDIS_URL: 'rediss://default:password@redis.example.com:6379',
    QUEUE_DRIVER: 'bullmq',
    QUEUE_CONCURRENCY: '5',
    QUEUE_STRICT: 'false',
    USE_MEMORY_REDIS: 'false',
    JWT_SECRET: 'a'.repeat(64),
    JWT_EXPIRE: '15m',
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    JWT_REFRESH_EXPIRE: '7d',
    RESEND_API_KEY: 're_test_key',
    MAIL_FROM: 'ChatApp <no-reply@example.com>',
    LOG_LEVEL: 'info',
    UPLOAD_PATH: '/app/uploads',
    MAX_FILE_SIZE: '10485760',
    ALLOWED_FILE_TYPES: 'jpeg,png,pdf'
};

describe('Environment validation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv, ...validProductionEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('accepts a complete production configuration', () => {
        expect(() => validateEnvironment()).not.toThrow();
    });

    it('fails when a required value is missing', () => {
        delete process.env.RESEND_API_KEY;
        expect(() => validateEnvironment()).toThrow('Missing required environment variables: RESEND_API_KEY');
    });

    it('requires different secure JWT secrets', () => {
        process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET;
        expect(() => validateEnvironment()).toThrow('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    });

    it('requires Redis for BullMQ', () => {
        delete process.env.REDIS_URL;
        expect(() => validateEnvironment()).toThrow('REDIS_URL is required when QUEUE_DRIVER=bullmq');
    });

    it('rejects non-HTTPS production origins', () => {
        process.env.ALLOWED_ORIGINS = 'http://app.example.com';
        expect(() => validateEnvironment()).toThrow('Every ALLOWED_ORIGINS entry must be a valid HTTPS URL');
    });
});
