const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');

router.get('/health', async (req, res) => {
    const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        services: {}
    };

    try {
        if (mongoose.connection.readyState === 1) {
            health.services.mongodb = { status: 'connected' };
        } else {
            health.services.mongodb = { status: 'disconnected' };
            health.status = 'unhealthy';
        }
    } catch (error) {
        health.services.mongodb = { status: 'error', message: error.message };
        health.status = 'unhealthy';
    }

    try {
        await redisClient.ping();
        health.services.redis = { status: 'connected' };
    } catch (error) {
        health.services.redis = { status: 'error', message: error.message };
        health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

module.exports = router;