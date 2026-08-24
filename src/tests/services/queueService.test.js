const { resolveDriver } = require('../../services/queueService');

describe('Queue driver selection', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('uses BullMQ when explicitly configured', () => {
        process.env.QUEUE_DRIVER = 'bullmq';
        expect(resolveDriver()).toBe('bullmq');
    });

    it('uses RabbitMQ when explicitly configured', () => {
        process.env.QUEUE_DRIVER = 'rabbitmq';
        expect(resolveDriver()).toBe('rabbitmq');
    });

    it('auto-selects Redis/BullMQ before RabbitMQ', () => {
        process.env.QUEUE_DRIVER = 'auto';
        process.env.REDIS_URL = 'redis://example';
        process.env.RABBITMQ_URL = 'amqp://example';
        expect(resolveDriver()).toBe('bullmq');
    });

    it('falls back to memory when no broker is configured', () => {
        process.env.QUEUE_DRIVER = 'auto';
        delete process.env.REDIS_URL;
        delete process.env.RABBITMQ_URL;
        expect(resolveDriver()).toBe('memory');
    });
});
