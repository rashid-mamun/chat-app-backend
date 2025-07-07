const { Queue, Worker } = require('bullmq');
const { createClient } = require('redis');

const connection = { url: process.env.REDIS_URL };

// Create a queue for file processing
const fileQueue = new Queue('file-processing', { connection });

// Worker to process file jobs
const fileWorker = new Worker(
    'file-processing',
    async (job) => {
        const { filePath, userId, chatType, recipientId, groupId } = job.data;
        console.log(`Processing file: ${filePath} for user ${userId}`);

        // Simulate file processing (e.g., resizing images)
        const processedFileUrl = `/processed/${filePath.split('/').pop()}`;

        return { processedFileUrl, userId, chatType, recipientId, groupId };
    },
    { connection }
);

fileWorker.on('completed', (job, result) => {
    console.log(`File processing completed: ${result.processedFileUrl}`);
});

fileWorker.on('failed', (job, err) => {
    console.error(`File processing failed: ${err.message}`);
});

// Function to add file processing job
const addFileJob = async (filePath, userId, chatType, recipientId, groupId) => {
    await fileQueue.add('process-file', { filePath, userId, chatType, recipientId, groupId });
};

module.exports = { addFileJob };