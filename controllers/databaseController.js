import { createBackup, restoreBackup } from '../utils/backupHelper.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import Notification from '../models/Notification.js';
import ArchivedRequest from '../models/ArchivedRequest.js';

// @desc    Download Database Backup
// @route   GET /api/database/backup
// @access  Private/Admin
const downloadBackup = async (req, res) => {
    try {
        const backup = await createBackup();
        const filename = `findmydocs-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(JSON.stringify(backup, null, 2));

    } catch (error) {
        console.error("Backup failed:", error);
        res.status(500).json({ message: 'Backup creation failed', error: error.message });
    }
};

// @desc    Restore Database from Backup
// @route   POST /api/database/restore
// @access  Private/Admin
const restoreDatabase = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No backup file uploaded' });
        }

        const fileContent = req.file.buffer.toString('utf8');
        let backupData;

        try {
            backupData = JSON.parse(fileContent);
        } catch (e) {
            return res.status(400).json({ message: 'Invalid JSON file' });
        }

        const report = await restoreBackup(backupData);

        res.status(200).json({ message: 'Database restored successfully', report });

    } catch (error) {
        console.error("Restore failed:", error);
        res.status(500).json({ message: 'Database restore failed', error: error.message });
    }
};


// @desc    Get Database Statistics
// @route   GET /api/database/stats
// @access  Private/Admin
const getDatabaseStats = async (req, res) => {
    try {
        const stats = {
            users: await User.countDocuments(),
            excuseRequests: await ExcuseRequest.countDocuments(),
            leaveRequests: await LeaveRequest.countDocuments(),
            letters: await Letter.countDocuments(),
            notifications: await Notification.countDocuments(),
            archived: await ArchivedRequest.countDocuments(),
            dbStats: {}
        };

        // Low-level DB stats
        if (mongoose.connection.db) {
            const dbStats = await mongoose.connection.db.stats();
            stats.dbStats = {
                dataSize: dbStats.dataSize, // bytes
                storageSize: dbStats.storageSize, // bytes
                objects: dbStats.objects,
                collections: dbStats.collections,
                avgObjSize: dbStats.avgObjSize
            };
        }

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
    }
};

export {
    downloadBackup,
    restoreDatabase,
    getDatabaseStats
};
