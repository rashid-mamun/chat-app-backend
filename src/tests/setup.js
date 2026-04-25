// Set test environment
process.env.NODE_ENV = 'test';

// Load test environment variables (.env.test takes priority over .env)
require('dotenv').config({ path: './.env.test' });
require('dotenv').config({ path: './.env' });  // fallback for any missing vars
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { redisClient } = require('../config/redis');

let mongoServer;

beforeAll(async () => {
    // Start in-memory MongoDB server
    // NOTE: First run may take 1-2 minutes to download MongoDB binary
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory database
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // Connect to Redis (guard against race conditions)
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}, 120000);  // 2 minute timeout for first-time MongoDB binary download

beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }

    // Clear Redis
    if (redisClient.isOpen) {
        await redisClient.flushAll();
    }
});

afterAll(async () => {
    // Close MongoDB connection
    await mongoose.connection.close();

    // Stop in-memory server
    if (mongoServer) {
        await mongoServer.stop();
    }

    // Close Redis connection
    if (redisClient.isOpen) {
        await redisClient.quit();
    }
}, 120000);  // 2 minute timeout for teardown