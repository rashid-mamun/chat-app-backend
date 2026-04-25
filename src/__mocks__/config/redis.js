/**
 * Jest manual mock for src/config/redis.js
 * 
 * This mock replaces the real Redis client with an in-memory Map-based store
 * so tests can run without a real Redis server.
 * 
 * Place this file at: src/__mocks__/config/redis.js
 * Jest automatically uses files in __mocks__ directories adjacent to the module.
 */

const store = new Map();

const redisClient = {
    isOpen: true,

    async get(key) {
        const item = store.get(key);
        if (!item) return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            store.delete(key);
            return null;
        }
        return item.value;
    },

    async set(key, value, options = {}) {
        const entry = { value };
        if (options.EX) {
            entry.expiresAt = Date.now() + options.EX * 1000;
        }
        store.set(key, entry);
        return 'OK';
    },

    async del(key) {
        store.delete(key);
        return 1;
    },

    async flushAll() {
        store.clear();
        return 'OK';
    },

    async ping() {
        return 'PONG';
    },

    async connect() {
        return this;
    },

    async quit() {
        store.clear();
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
        // no-op: no real event emitter needed in tests
        return this;
    }
};

const connectRedis = async () => redisClient;

module.exports = { redisClient, connectRedis };
