const request = require('supertest');
const app = require('../../../server');

describe('Health Routes', () => {
    describe('GET /api/v1/health', () => {
        it('should return healthy status when all services are connected', async () => {
            const response = await request(app)
                .get('/api/v1/health')
                .expect(200);

            expect(response.body.timestamp).toBeDefined();
            expect(response.body.status).toBe('healthy');
            expect(response.body.version).toBeDefined();
            expect(response.body.uptime).toBeDefined();
            expect(response.body.services).toBeDefined();
            expect(response.body.services.mongodb.status).toBe('connected');
            expect(response.body.services.redis.status).toBe('connected');
        });
    });
}); 