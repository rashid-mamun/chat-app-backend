const { createClient } = require('redis');
const logger = require('../utils/logger');

// In-memory store fallback
const memoryStore = new Map();

const memoryRedisClient = {
    isMemory: true,
    isOpen: true,

    async get(key) {
        const item = memoryStore.get(key);
        if (!item) return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            memoryStore.delete(key);
            return null;
        }
        return item.value;
    },

    async set(key, value, options = {}) {
        const entry = { value };
        if (options.EX) {
            entry.expiresAt = Date.now() + options.EX * 1000;
        }
        memoryStore.set(key, entry);
        return 'OK';
    },

    async del(key) {
        memoryStore.delete(key);
        return 1;
    },

    async flushAll() {
        memoryStore.clear();
        return 'OK';
    },

    async ping() {
        return 'PONG';
    },

    async connect() {
        return this;
    },

    async quit() {
        memoryStore.clear();
        return 'OK';
    },

    duplicate() {
        return {
            ...this,
            connect: async () => this,
            on: () => this,
            subscribe: async () => {},
            pSubscribe: async () => {},
            unsubscribe: async () => {},
            pUnsubscribe: async () => {},
            publish: async () => 1
        };
    },

    on() {
        return this;
    }
};

let realClient;
try {
    realClient = createClient({
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 2) {
                    return false; // Stop reconnecting after 2 tries in dev
                }
                return 500;
            }
        }
    });

    realClient.on('connect', () => {
        logger.info('Redis Client Connected', { service: 'chat-app' });
    });

    realClient.on('ready', () => {
        logger.info('Redis Client Ready', { service: 'chat-app' });
    });

    realClient.on('error', (err) => {
        logger.warn('Redis Client Error (will use in-memory fallback if needed): ' + err.message);
    });
} catch (err) {
    logger.warn('Failed to initialize Redis client: ' + err.message);
}

// Active client reference (starts as real client or memory client)
let activeClient = realClient || memoryRedisClient;

const redisClientProxy = new Proxy({}, {
    get(target, prop) {
        if (prop === 'isOpen') {
            return activeClient.isOpen;
        }
        if (prop === 'isMemory') {
            return activeClient.isMemory || false;
        }
        if (typeof activeClient[prop] === 'function') {
            return activeClient[prop].bind(activeClient);
        }
        return activeClient[prop];
    }
});

const connectRedis = async () => {
    if (process.env.USE_MEMORY_REDIS === 'true') {
        logger.info('Using In-Memory store for Redis (USE_MEMORY_REDIS=true)');
        activeClient = memoryRedisClient;
        return redisClientProxy;
    }

    try {
        if (realClient && !realClient.isOpen) {
            await realClient.connect();
            activeClient = realClient;
            logger.info('Redis connected successfully', { service: 'chat-app' });
        }
        return redisClientProxy;
    } catch (error) {
        logger.warn(`Redis connection to ${process.env.REDIS_URL || 'redis://127.0.0.1:6379'} failed (${error.message}). Falling back to In-Memory store.`);
        activeClient = memoryRedisClient;
        return redisClientProxy;
    }
};

module.exports = { redisClient: redisClientProxy, connectRedis };