const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        let mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp';

        // Prefer IPv4 127.0.0.1 to avoid ECONNREFUSED on Windows IPv6 ::1
        if (mongoUri.includes('localhost')) {
            mongoUri = mongoUri.replace('localhost', '127.0.0.1');
        }

        const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });

        logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
    } catch (error) {
        logger.error(`Error connecting to MongoDB: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;
