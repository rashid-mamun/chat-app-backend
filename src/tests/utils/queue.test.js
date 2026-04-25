const { Queue } = require('bullmq');
const { redisClient } = require('../../config/redis');

jest.mock('bullmq');
jest.mock('../../config/redis', () => ({
    redisClient: {}
}));

describe('Queue Utility', () => {
    let queue;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize messageQueue with correct options', () => {
        // Require it to trigger initialization
        const queueModule = require('../../utils/queue');
        
        expect(Queue).toHaveBeenCalledWith('messages', {
            connection: redisClient,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 }
            }
        });
        
        expect(queueModule.messageQueue).toBeDefined();
    });
});
