// Set test environment
process.env.NODE_ENV = 'test';

require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { redisClient } = require('../config/redis');

let mongoServer;

beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory database
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // Connect to Redis
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}, 30000);

beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }

    // Clear Redis
    await redisClient.flushAll();
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
}, 30000);