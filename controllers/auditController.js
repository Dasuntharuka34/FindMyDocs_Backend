import AuditLog from '../models/AuditLog.js';

// @desc    Create audit log entry
// @route   POST /api/audit/log
// @access  Private/Admin
const createAuditLog = async (req, res) => {
    try {
        const {
            action,
            targetType,
            targetId,
            targetName,
            changes,
            metadata,
            status = 'SUCCESS',
            errorMessage,
        } = req.body;

        const auditLog = await AuditLog.create({
            userId: req.user._id,
            userName: req.user.name,
            action,
            targetType,
            targetId,
            targetName,
            changes,
            metadata,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            status,
            errorMessage,
        });

        res.status(201).json(auditLog);
    } catch (error) {
        console.error('Error creating audit log:', error);
        res.status(500).json({ message: 'Error creating audit log', error: error.message });
    }
};

// Helper function to create audit log (can be used in other controllers)
const logAuditAction = async (userId, userName, action, targetType, targetId, targetName, changes, metadata, req) => {
    try {
        await AuditLog.create({
            userId,
            userName,
            action,
            targetType,
            targetId,
            targetName,
            changes,
            metadata,
            ipAddress: req?.ip || req?.connection?.remoteAddress,
            userAgent: req?.get('user-agent'),
            status: 'SUCCESS',
        });
    } catch (error) {
        console.error('Error logging audit action:', error);
    }
};

// @desc    Get audit logs with filters
// @route   GET /api/audit/logs
// @access  Private/Admin
const getAuditLogs = async (req, res) => {
    try {
        const {
            userId,
            action,
            targetType,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = req.query;

        const query = {};

        if (userId) query.userId = userId;
        if (action) query.action = action;
        if (targetType) query.targetType = targetType;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name email role'),
            AuditLog.countDocuments(query),
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
};

// @desc    Export audit logs to CSV
// @route   GET /api/audit/export
// @access  Private/Admin
const exportAuditLogs = async (req, res) => {
    try {
        const {
            userId,
            action,
            targetType,
            startDate,
            endDate,
        } = req.query;

        const query = {};

        if (userId) query.userId = userId;
        if (action) query.action = action;
        if (targetType) query.targetType = targetType;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const logs = await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .populate('userId', 'name email role')
            .lean();

        // Convert to CSV format
        const csvHeaders = [
            'Timestamp',
            'User',
            'Email',
            'Action',
            'Target Type',
            'Target ID',
            'Target Name',
            'Status',
            'IP Address',
        ];

        const csvRows = logs.map(log => [
            new Date(log.createdAt).toISOString(),
            log.userName,
            log.userId?.email || 'N/A',
            log.action,
            log.targetType || 'N/A',
            log.targetId || 'N/A',
            log.targetName || 'N/A',
            log.status,
            log.ipAddress || 'N/A',
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ message: 'Error exporting audit logs', error: error.message });
    }
};

// @desc    Get audit log statistics
// @route   GET /api/audit/stats
// @access  Private/Admin
const getAuditStats = async (req, res) => {
    try {
        const { period = 'week' } = req.query;

        const now = new Date();
        let startDate;

        switch (period) {
            case 'day':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }

        const [actionStats, userStats, statusStats] = await Promise.all([
            AuditLog.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            AuditLog.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$userName', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            AuditLog.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);

        res.json({
            period,
            startDate,
            endDate: new Date(),
            actionStats,
            topUsers: userStats,
            statusStats,
        });
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ message: 'Error fetching audit stats', error: error.message });
    }
};

export {
    createAuditLog,
    logAuditAction,
    getAuditLogs,
    exportAuditLogs,
    getAuditStats,
};
