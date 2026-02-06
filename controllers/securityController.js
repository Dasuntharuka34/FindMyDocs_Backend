import SecurityLog from '../models/SecurityLog.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import Registration from '../models/Registration.js';
import Role from '../models/Role.js';

// @desc    Get security logs
// @route   GET /api/security/logs
// @access  Private/Admin
const getSecurityLogs = async (req, res) => {
    try {
        const {
            userId,
            eventType,
            success,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = req.query;

        const query = {};

        if (userId) query.userId = userId;
        if (eventType) query.eventType = eventType;
        if (success !== undefined) query.success = success === 'true';

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            SecurityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name email role'),
            SecurityLog.countDocuments(query),
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
        console.error('Error fetching security logs:', error);
        res.status(500).json({ message: 'Error fetching security logs', error: error.message });
    }
};

// @desc    Get active sessions
// @route   GET /api/security/sessions
// @access  Private/Admin
const getActiveSessions = async (req, res) => {
    try {
        const sessions = await Session.find({ isActive: true })
            .populate('userId', 'name email role department')
            .sort({ lastActivity: -1 });

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ message: 'Error fetching active sessions', error: error.message });
    }
};

// @desc    Terminate a session (force logout)
// @route   DELETE /api/security/sessions/:id
// @access  Private/Admin
const terminateSession = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await Session.findById(id);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        session.isActive = false;
        await session.save();

        res.json({ message: 'Session terminated successfully' });
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ message: 'Error terminating session', error: error.message });
    }
};

// @desc    Get permission audit
// @route   GET /api/security/permissions-audit
// @access  Private/Admin
const getPermissionAudit = async (req, res) => {
    try {
        const [users, roles] = await Promise.all([
            User.find({}, 'name email role department isActive'),
            Role.find({})
        ]);

        const rolePermissionsMap = roles.reduce((acc, role) => {
            acc[role.name.toLowerCase()] = role.permissions;
            return acc;
        }, {});

        // Include Admin default if not in roles table
        if (!rolePermissionsMap['admin']) {
            rolePermissionsMap['admin'] = ['ALL_PERMISSIONS'];
        }

        const audit = users.map(user => {
            const userRoleLower = user.role?.toLowerCase() || '';
            return {
                userId: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                isActive: user.isActive,
                permissions: rolePermissionsMap[userRoleLower] || [],
            };
        });

        res.json(audit);
    } catch (error) {
        console.error('Error fetching permission audit:', error);
        res.status(500).json({ message: 'Error fetching permission audit', error: error.message });
    }
};

// @desc    Export user data (GDPR compliance)
// @route   GET /api/security/export-user-data/:userId
// @access  Private/Admin
const exportUserData = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get all user data
        const [excuseRequests, leaveRequests, letters, registrations, securityLogs] = await Promise.all([
            ExcuseRequest.find({ studentName: user.name }).lean(),
            LeaveRequest.find({ studentName: user.name }).lean(),
            Letter.find({ student: user.name }).lean(),
            Registration.find({ email: user.email }).lean(),
            SecurityLog.find({ userId: user._id }).lean(),
        ]);

        const userData = {
            personalInfo: {
                name: user.name,
                email: user.email,
                nic: user.nic,
                mobile: user.mobile,
                role: user.role,
                department: user.department,
                indexNumber: user.indexNumber,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
            requests: {
                excuseRequests,
                leaveRequests,
                letters,
            },
            registrations,
            securityLogs,
        };

        res.json(userData);
    } catch (error) {
        console.error('Error exporting user data:', error);
        res.status(500).json({ message: 'Error exporting user data', error: error.message });
    }
};

// @desc    Anonymize user data
// @route   POST /api/security/anonymize-user/:userId
// @access  Private/Admin
const anonymizeUserData = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Anonymize user data
        const anonymizedEmail = `anonymized_${user._id}@deleted.com`;
        const anonymizedName = `Anonymized User ${user._id.toString().slice(-6)}`;

        user.name = anonymizedName;
        user.email = anonymizedEmail;
        user.nic = `ANON${user._id.toString().slice(-9)}`;
        user.mobile = null;
        user.profilePicture = null;
        user.isActive = false;

        await user.save();

        res.json({ message: 'User data anonymized successfully', user });
    } catch (error) {
        console.error('Error anonymizing user data:', error);
        res.status(500).json({ message: 'Error anonymizing user data', error: error.message });
    }
};

export {
    getSecurityLogs,
    getActiveSessions,
    terminateSession,
    getPermissionAudit,
    exportUserData,
    anonymizeUserData,
};
