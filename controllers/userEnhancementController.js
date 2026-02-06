import User from '../models/User.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import bcrypt from 'bcryptjs';
import { logAuditAction } from './auditController.js';

// @desc    Bulk import users from CSV
// @route   POST /api/users/bulk-import
// @access  Private/Admin
const bulkImportUsers = async (req, res) => {
    try {
        const { users } = req.body; // Array of user objects

        const results = {
            success: [],
            failed: [],
        };

        for (const userData of users) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({
                    $or: [
                        { email: userData.email },
                        { nic: userData.nic },
                        { mobile: userData.mobile },
                    ],
                });

                if (existingUser) {
                    results.failed.push({
                        data: userData,
                        reason: 'User already exists',
                    });
                    continue;
                }

                // Hash password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(userData.password || 'password123', salt);

                // Create user
                const user = await User.create({
                    ...userData,
                    password: hashedPassword,
                });

                results.success.push(user);

                // Log audit action
                await logAuditAction(
                    req.user._id,
                    req.user.name,
                    'USER_CREATED',
                    'User',
                    user._id,
                    user.name,
                    { bulkImport: true },
                    {},
                    req
                );
            } catch (error) {
                results.failed.push({
                    data: userData,
                    reason: error.message,
                });
            }
        }

        res.json({
            message: `Imported ${results.success.length} users, ${results.failed.length} failed`,
            results,
        });
    } catch (error) {
        console.error('Error bulk importing users:', error);
        res.status(500).json({ message: 'Error bulk importing users', error: error.message });
    }
};

// @desc    Bulk reset passwords
// @route   POST /api/users/bulk-reset-password
// @access  Private/Admin
const bulkResetPasswords = async (req, res) => {
    try {
        const { userIds, defaultPassword = 'password123' } = req.body;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        const result = await User.updateMany(
            { _id: { $in: userIds } },
            { password: hashedPassword, loginAttempts: 0 }
        );

        // Log audit action
        await logAuditAction(
            req.user._id,
            req.user.name,
            'BULK_OPERATION',
            'User',
            null,
            'Password Reset',
            { userIds, count: result.modifiedCount },
            {},
            req
        );

        res.json({
            message: `Password reset for ${result.modifiedCount} users`,
            modifiedCount: result.modifiedCount,
        });
    } catch (error) {
        console.error('Error bulk resetting passwords:', error);
        res.status(500).json({ message: 'Error bulk resetting passwords', error: error.message });
    }
};

// @desc    Bulk update roles
// @route   POST /api/users/bulk-update-roles
// @access  Private/Admin
const bulkUpdateRoles = async (req, res) => {
    try {
        const { userIds, role } = req.body;

        const result = await User.updateMany(
            { _id: { $in: userIds } },
            { role }
        );

        // Log audit action
        await logAuditAction(
            req.user._id,
            req.user.name,
            'BULK_OPERATION',
            'User',
            null,
            'Role Update',
            { userIds, role, count: result.modifiedCount },
            {},
            req
        );

        res.json({
            message: `Role updated for ${result.modifiedCount} users`,
            modifiedCount: result.modifiedCount,
        });
    } catch (error) {
        console.error('Error bulk updating roles:', error);
        res.status(500).json({ message: 'Error bulk updating roles', error: error.message });
    }
};

// @desc    Bulk delete users
// @route   POST /api/users/bulk-delete
// @access  Private/Admin
const bulkDeleteUsers = async (req, res) => {
    try {
        const { userIds } = req.body;

        const result = await User.deleteMany({ _id: { $in: userIds } });

        // Log audit action
        await logAuditAction(
            req.user._id,
            req.user.name,
            'BULK_OPERATION',
            'User',
            null,
            'User Deletion',
            { userIds, count: result.deletedCount },
            {},
            req
        );

        res.json({
            message: `Deleted ${result.deletedCount} users`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Error bulk deleting users:', error);
        res.status(500).json({ message: 'Error bulk deleting users', error: error.message });
    }
};

// @desc    Get user activity history
// @route   GET /api/users/:id/activity
// @access  Private/Admin
const getUserActivityHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const [excuseRequests, leaveRequests, letters] = await Promise.all([
            ExcuseRequest.find({ studentName: user.name }).sort({ submittedDate: -1 }),
            LeaveRequest.find({ studentName: user.name }).sort({ submittedDate: -1 }),
            Letter.find({ student: user.name }).sort({ submittedDate: -1 }),
        ]);

        const allActivity = [
            ...excuseRequests.map(r => ({ ...r.toObject(), type: 'excuse' })),
            ...leaveRequests.map(r => ({ ...r.toObject(), type: 'leave' })),
            ...letters.map(r => ({ ...r.toObject(), type: 'letter' })),
        ].sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

        res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
            },
            activity: allActivity,
            summary: {
                totalRequests: allActivity.length,
                excuseRequests: excuseRequests.length,
                leaveRequests: leaveRequests.length,
                letters: letters.length,
            },
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ message: 'Error fetching user activity', error: error.message });
    }
};

// @desc    Toggle user active status
// @route   PUT /api/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isActive = !user.isActive;
        await user.save();

        // Log audit action
        await logAuditAction(
            req.user._id,
            req.user.name,
            'USER_STATUS_CHANGED',
            'User',
            user._id,
            user.name,
            { isActive: user.isActive },
            {},
            req
        );

        res.json({
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            user,
        });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ message: 'Error toggling user status', error: error.message });
    }
};

// @desc    Advanced user search
// @route   POST /api/users/search
// @access  Private/Admin
const searchUsers = async (req, res) => {
    try {
        const { query, role, department, isActive, page = 1, limit = 50 } = req.body;

        const searchQuery = {};

        if (query) {
            searchQuery.$or = [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { nic: { $regex: query, $options: 'i' } },
                { mobile: { $regex: query, $options: 'i' } },
            ];
        }

        if (role) searchQuery.role = role;
        if (department) searchQuery.department = department;
        if (isActive !== undefined) searchQuery.isActive = isActive;

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find(searchQuery)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            User.countDocuments(searchQuery),
        ]);

        res.json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Error searching users', error: error.message });
    }
};

export {
    bulkImportUsers,
    bulkResetPasswords,
    bulkUpdateRoles,
    bulkDeleteUsers,
    getUserActivityHistory,
    toggleUserStatus,
    searchUsers,
};
