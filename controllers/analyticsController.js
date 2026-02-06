import User from '../models/User.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import Registration from '../models/Registration.js';
import AuditLog from '../models/AuditLog.js';
import SecurityLog from '../models/SecurityLog.js';

// @desc    Get activity dashboard metrics
// @route   GET /api/analytics/activity
// @access  Private/Admin
const getActivityDashboard = async (req, res) => {
    try {
        const { period = 'week' } = req.query; // day, week, month

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

        // Get counts for the period
        const [
            newUsers,
            newRegistrations,
            excuseRequests,
            leaveRequests,
            letterRequests,
            approvedRequests,
            rejectedRequests,
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: startDate } }),
            Registration.countDocuments({ createdAt: { $gte: startDate } }),
            ExcuseRequest.countDocuments({ submittedDate: { $gte: startDate } }),
            LeaveRequest.countDocuments({ submittedDate: { $gte: startDate } }),
            Letter.countDocuments({ submittedDate: { $gte: startDate } }),
            Promise.all([
                ExcuseRequest.countDocuments({ status: 'Approved', updatedAt: { $gte: startDate } }),
                LeaveRequest.countDocuments({ status: 'Approved', updatedAt: { $gte: startDate } }),
                Letter.countDocuments({ status: 'Approved', updatedAt: { $gte: startDate } }),
            ]).then(counts => counts.reduce((a, b) => a + b, 0)),
            Promise.all([
                ExcuseRequest.countDocuments({ status: 'Rejected', updatedAt: { $gte: startDate } }),
                LeaveRequest.countDocuments({ status: 'Rejected', updatedAt: { $gte: startDate } }),
                Letter.countDocuments({ status: 'Rejected', updatedAt: { $gte: startDate } }),
            ]).then(counts => counts.reduce((a, b) => a + b, 0)),
        ]);

        const totalRequests = excuseRequests + leaveRequests + letterRequests;

        res.json({
            period,
            startDate,
            endDate: new Date(),
            metrics: {
                newUsers,
                newRegistrations,
                totalRequests,
                excuseRequests,
                leaveRequests,
                letterRequests,
                approvedRequests,
                rejectedRequests,
                approvalRate: totalRequests > 0 ? ((approvedRequests / totalRequests) * 100).toFixed(2) : 0,
            },
        });
    } catch (error) {
        console.error('Error fetching activity dashboard:', error);
        res.status(500).json({ message: 'Error fetching activity dashboard', error: error.message });
    }
};

// @desc    Get system health metrics
// @route   GET /api/analytics/system-health
// @access  Private/Admin
const getSystemHealth = async (req, res) => {
    try {
        const mongoose = (await import('mongoose')).default;

        // Database connection status
        const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';

        // Get collection stats
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionStats = await Promise.all(
            collections.map(async (col) => {
                const stats = await mongoose.connection.db.collection(col.name).stats();
                return {
                    name: col.name,
                    count: stats.count,
                    size: stats.size,
                    avgObjSize: stats.avgObjSize,
                };
            })
        );

        // Get recent error count
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentErrors = await SecurityLog.countDocuments({
            success: false,
            createdAt: { $gte: last24Hours },
        });

        // Get active sessions count
        const Session = mongoose.model('Session');
        const activeSessions = await Session.countDocuments({ isActive: true });

        res.json({
            status: 'healthy',
            timestamp: new Date(),
            database: {
                status: dbStatus,
                collections: collectionStats,
            },
            errors: {
                last24Hours: recentErrors,
            },
            sessions: {
                active: activeSessions,
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        });
    } catch (error) {
        console.error('Error fetching system health:', error);
        res.status(500).json({
            status: 'unhealthy',
            message: 'Error fetching system health',
            error: error.message
        });
    }
};

// @desc    Get usage statistics
// @route   GET /api/analytics/usage
// @access  Private/Admin
const getUsageStatistics = async (req, res) => {
    try {
        // Most active users (by request count)
        const [excuseByUser, leaveByUser, letterByUser] = await Promise.all([
            ExcuseRequest.aggregate([
                { $group: { _id: '$studentName', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            LeaveRequest.aggregate([
                { $group: { _id: '$studentName', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            Letter.aggregate([
                { $group: { _id: '$student', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
        ]);

        // Combine and aggregate user activity
        const userActivityMap = new Map();
        [...excuseByUser, ...leaveByUser, ...letterByUser].forEach(item => {
            const name = item._id;
            const current = userActivityMap.get(name) || 0;
            userActivityMap.set(name, current + item.count);
        });

        const mostActiveUsers = Array.from(userActivityMap.entries())
            .map(([name, count]) => ({ name, requestCount: count }))
            .sort((a, b) => b.requestCount - a.requestCount)
            .slice(0, 10);

        // Requests by department
        const requestsByDepartment = await User.aggregate([
            {
                $lookup: {
                    from: 'excuserequests',
                    localField: 'name',
                    foreignField: 'studentName',
                    as: 'excuseRequests',
                },
            },
            {
                $lookup: {
                    from: 'leaverequests',
                    localField: 'name',
                    foreignField: 'studentName',
                    as: 'leaveRequests',
                },
            },
            {
                $group: {
                    _id: '$department',
                    totalRequests: {
                        $sum: {
                            $add: [
                                { $size: '$excuseRequests' },
                                { $size: '$leaveRequests' },
                            ],
                        },
                    },
                },
            },
            { $sort: { totalRequests: -1 } },
        ]);

        // Peak usage times (requests by hour)
        const peakTimes = await ExcuseRequest.aggregate([
            {
                $project: {
                    hour: { $hour: '$submittedDate' },
                },
            },
            {
                $group: {
                    _id: '$hour',
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.json({
            mostActiveUsers,
            requestsByDepartment,
            peakTimes,
        });
    } catch (error) {
        console.error('Error fetching usage statistics:', error);
        res.status(500).json({ message: 'Error fetching usage statistics', error: error.message });
    }
};

// @desc    Get request analytics
// @route   GET /api/analytics/requests
// @access  Private/Admin
const getRequestAnalytics = async (req, res) => {
    try {
        // Average approval time by request type
        const excuseApprovalTimes = await ExcuseRequest.aggregate([
            { $match: { status: 'Approved' } },
            {
                $project: {
                    approvalTime: {
                        $subtract: ['$updatedAt', '$submittedDate'],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgTime: { $avg: '$approvalTime' },
                },
            },
        ]);

        const leaveApprovalTimes = await LeaveRequest.aggregate([
            { $match: { status: 'Approved' } },
            {
                $project: {
                    approvalTime: {
                        $subtract: ['$updatedAt', '$submittedDate'],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgTime: { $avg: '$approvalTime' },
                },
            },
        ]);

        const letterApprovalTimes = await Letter.aggregate([
            { $match: { status: 'Approved' } },
            {
                $project: {
                    approvalTime: {
                        $subtract: ['$updatedAt', '$submittedDate'],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgTime: { $avg: '$approvalTime' },
                },
            },
        ]);

        // Status distribution
        const [excuseStatus, leaveStatus, letterStatus] = await Promise.all([
            ExcuseRequest.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            LeaveRequest.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Letter.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);

        // Convert milliseconds to hours
        const msToHours = (ms) => ms ? (ms / (1000 * 60 * 60)).toFixed(2) : 0;

        res.json({
            averageApprovalTimes: {
                excuse: msToHours(excuseApprovalTimes[0]?.avgTime),
                leave: msToHours(leaveApprovalTimes[0]?.avgTime),
                letter: msToHours(letterApprovalTimes[0]?.avgTime),
            },
            statusDistribution: {
                excuse: excuseStatus,
                leave: leaveStatus,
                letter: letterStatus,
            },
        });
    } catch (error) {
        console.error('Error fetching request analytics:', error);
        res.status(500).json({ message: 'Error fetching request analytics', error: error.message });
    }
};

export {
    getActivityDashboard,
    getSystemHealth,
    getUsageStatistics,
    getRequestAnalytics,
};
