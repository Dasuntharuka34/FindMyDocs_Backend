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

        // Helper to clean regex strings into paths
        const extractPathFromRegexp = (regexp) => {
            if (!regexp) return '';
            const regStr = regexp.toString();

            // Handle fast_slash (default /)
            if (regStr === '/^\\/?(?=\\/|$)/i') return '';

            // Try to match standard Express route regex format: /^\/api\/users\/?(?=\/|$)/i
            // We want to extract /api/users
            const match = regStr.match(/^\/\\(.*?)\\\/\?(\(\?=\/\|\$\))?\/i/);
            if (match && match[1]) {
                return '/' + match[1].replace(/\\/g, '');
            }

            // Fallback: simpler cleaning for varying express versions/regexes
            let cleaner = regStr
                .replace(/^\/\^/, '')            // remove leading /^
                .replace(/\\\/\?\(\?=\/\|\$\)\/i$/, '') // remove trailing \/?(?=/|$)/i
                .replace(/\\/g, '')              // remove escapes
                .replace(/\/$/g, '');            // remove trailing slash

            if (cleaner.startsWith('/')) return cleaner;

            return '';
        };

        const processStack = (stack, basePath = '') => {
            if (!stack || !Array.isArray(stack)) return;

            stack.forEach(layer => {
                if (layer.route) {
                    const path = basePath + layer.route.path;
                    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();

                    // Extract Access Level & Description
                    let access = 'Public';
                    let description = 'description';

                    if (layer.route.stack && layer.route.stack.length > 0) {
                        const stackNames = layer.route.stack.map(h => h.name);

                        if (stackNames.includes('protect')) {
                            access = stackNames.includes('admin') ? 'Admin' : 'Private';
                        }

                        // Try to find the last handler name for description
                        // Filter out common middleware names
                        const handlerName = layer.route.stack.find(h =>
                            !['protect', 'prev', 'next', 'admin', 'upload', 'csvUpload', '<anonymous>', 'bound dispatch', 'ensureDbConnection'].includes(h.name) &&
                            h.name !== 'router'
                        )?.name;

                        if (handlerName) {
                            // Convert camelCase to human readable
                            description = handlerName
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/^./, str => str.toUpperCase());
                        }
                    }

                    routes.push({ path, method: methods, access, description });
                } else if (layer.name === 'router' && layer.handle.stack) {
                    let mountedPath = extractPathFromRegexp(layer.regexp);
                    processStack(layer.handle.stack, basePath + mountedPath);
                }
            });
        };

        if (req.app._router && req.app._router.stack) {
            processStack(req.app._router.stack);
        } else if (req.app.router && req.app.router.stack) {
            processStack(req.app.router.stack);
        } else if (req.app.handle && req.app.handle.stack) {
            processStack(req.app.handle.stack);
        }

        res.json(routes);
    } catch (error) {
        console.error('Error generating API docs:', error);
        res.json([{ path: 'Error generating docs', method: 'ERROR', details: error.message }]);
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
