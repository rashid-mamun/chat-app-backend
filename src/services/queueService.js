const logger = require('../utils/logger');
const { sendPasswordResetEmail } = require('./emailService');

const QUEUE_NAME = 'chat-app-jobs';
const handlers = {
    'password-reset-email': sendPasswordResetEmail
};

let driver = 'memory';
let bullQueue;
let bullWorker;
let bullConnection;
let rabbitConnection;
let rabbitChannel;

const resolveDriver = () => {
    const configured = process.env.QUEUE_DRIVER?.toLowerCase();
    if (configured && !['auto', 'bullmq', 'rabbitmq', 'memory'].includes(configured)) {
        throw new Error('QUEUE_DRIVER must be auto, bullmq, rabbitmq, or memory');
    }
    if (configured && configured !== 'auto') return configured;
    if (process.env.REDIS_URL) return 'bullmq';
    if (process.env.RABBITMQ_URL) return 'rabbitmq';
    return 'memory';
};

const processJob = async (name, data) => {
    const handler = handlers[name];
    if (!handler) throw new Error(`Unsupported queue job: ${name}`);
    return handler(data);
};

const initializeBullMQ = async () => {
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the BullMQ driver');
    const IORedis = require('ioredis');
    const { Queue, Worker } = require('bullmq');
    bullConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        connectTimeout: 10000,
        tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
        retryStrategy: (attempt) => attempt > 5 ? null : Math.min(attempt * 500, 3000)
    });
    bullConnection.on('error', (error) => logger.warn(`BullMQ Redis error: ${error.message}`));
    bullQueue = new Queue(QUEUE_NAME, { connection: bullConnection });
    bullWorker = new Worker(
        QUEUE_NAME,
        (job) => processJob(job.name, job.data),
        { connection: bullConnection.duplicate(), concurrency: Number(process.env.QUEUE_CONCURRENCY || 5) }
    );
    bullWorker.on('failed', (job, error) => logger.error(`BullMQ job ${job?.id} failed: ${error.message}`));
    await bullQueue.waitUntilReady();
};

const initializeRabbitMQ = async () => {
    if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is required for the RabbitMQ driver');
    const amqp = require('amqplib');
    rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL);
    rabbitChannel = await rabbitConnection.createChannel();
    await rabbitChannel.assertQueue(QUEUE_NAME, { durable: true });
    await rabbitChannel.prefetch(Number(process.env.QUEUE_CONCURRENCY || 5));
    await rabbitChannel.consume(QUEUE_NAME, async (message) => {
        if (!message) return;
        try {
            const job = JSON.parse(message.content.toString());
            await processJob(job.name, job.data);
            rabbitChannel.ack(message);
        } catch (error) {
            logger.error(`RabbitMQ job failed: ${error.message}`);
            rabbitChannel.nack(message, false, false);
        }
    });
};

const initializeQueue = async () => {
    driver = resolveDriver();
    try {
        if (driver === 'bullmq') await initializeBullMQ();
        if (driver === 'rabbitmq') await initializeRabbitMQ();
    } catch (error) {
        if (process.env.QUEUE_STRICT === 'true') throw error;
        logger.warn(`${driver} unavailable (${error.message}); using immediate in-process fallback`);
        driver = 'memory';
    }
    logger.info(`Queue driver ready: ${driver}`);
    return driver;
};

const enqueue = async (name, data) => {
    if (driver === 'bullmq') {
        return bullQueue.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 100 });
    }
    if (driver === 'rabbitmq') {
        rabbitChannel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({ name, data })), { persistent: true });
        return;
    }
    // No broker configured: process immediately. This is resilient but not durable.
    return processJob(name, data);
};

const closeQueue = async () => {
    await bullWorker?.close();
    await bullQueue?.close();
    bullConnection?.disconnect();
    await rabbitChannel?.close();
    await rabbitConnection?.close();
};

module.exports = { initializeQueue, enqueue, closeQueue, resolveDriver };
