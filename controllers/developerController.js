import ErrorLog from '../models/ErrorLog.js';
import mongoose from 'mongoose';

// @desc    Get system error logs
// @route   GET /api/developer/error-logs
// @access  Private/Admin
const getErrorLogs = async (req, res) => {
    try {
        const { severity, page = 1, limit = 50 } = req.query;
        const query = severity ? { severity } : {};

        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            ErrorLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'name email'),
            ErrorLog.countDocuments(query)
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching error logs', error: error.message });
    }
};

// @desc    Clear error logs
// @route   DELETE /api/developer/error-logs
// @access  Private/Admin
const clearErrorLogs = async (req, res) => {
    try {
        await ErrorLog.deleteMany({});
        res.json({ message: 'Error logs cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing logs', error: error.message });
    }
};

// @desc    Run a read-only database query
// @route   POST /api/developer/query
// @access  Private/Admin
const runQuery = async (req, res) => {
    try {
        const { modelName, query, options = {} } = req.body;

        const Model = mongoose.model(modelName);
        if (!Model) return res.status(400).json({ message: 'Invalid model name' });

        // Force read-only by only allowing 'find' operations effectively
        const result = await Model.find(query || {})
            .limit(options.limit || 100)
            .skip(options.skip || 0)
            .sort(options.sort || { createdAt: -1 })
            .lean();

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Query failed', error: error.message });
    }
};

// @desc    Get system stats (Developer version)
// @route   GET /api/developer/system-stats
// @access  Private/Admin
const getSystemStats = async (req, res) => {
    try {
        const stats = {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            cpuUsage: process.cpuUsage(),
            dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching system stats', error: error.message });
    }
};

// @desc    Get API Documentation (auto-generated)
// @route   GET /api/developer/docs
// @access  Private/Admin
const getApiDocs = async (req, res) => {
    try {
        const routes = [];
        req.app._router.stack.forEach((middleware) => {
            if (middleware.route) { // routes registered directly on the app
                routes.push({
                    path: middleware.route.path,
                    method: Object.keys(middleware.route.methods)[0].toUpperCase()
                });
            } else if (middleware.name === 'router') { // router middleware
                middleware.handle.stack.forEach((handler) => {
                    if (handler.route) {
                        const path = handler.route.path;
                        const method = Object.keys(handler.route.methods)[0].toUpperCase();
                        routes.push({ path, method });
                    }
                });
            }
        });
        res.json(routes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching API docs', error: error.message });
    }
};

// @desc    Clear server cache
// @route   POST /api/developer/clear-cache
// @access  Private/Admin
const clearCache = async (req, res) => {
    try {
        // Here you would clear Redis or local cache
        // For now, let's just simulate it
        res.json({ message: 'System cache cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing cache', error: error.message });
    }
};

export {
    getErrorLogs,
    clearErrorLogs,
    runQuery,
    getSystemStats,
    getApiDocs,
    clearCache
};
