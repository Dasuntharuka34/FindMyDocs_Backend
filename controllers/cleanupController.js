import ExcuseRequest from '../models/ExcuseRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Letter from '../models/Letter.js';
import ArchivedRequest from '../models/ArchivedRequest.js';
import User from '../models/User.js';
import { listBlobs, deleteBlob } from '../config/vercelBlob.js';

// Helper to get model by collection name
const getModel = (type) => {
    switch (type) {
        case 'ExcuseRequest': return ExcuseRequest;
        case 'LeaveRequest': return LeaveRequest;
        case 'Letter': return Letter;
        default: return null;
    }
};

// @desc    Get cleanup statistics (count of old records)
// @route   GET /api/cleanup/stats
// @access  Private/Admin
const getCleanupStats = async (req, res) => {
    try {
        const { days } = req.query; // items older than X days
        const daysInt = parseInt(days) || 365; // Default 1 year
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInt);

        const stats = {
            ExcuseRequest: await ExcuseRequest.countDocuments({ submittedDate: { $lt: cutoffDate } }),
            LeaveRequest: await LeaveRequest.countDocuments({ submittedDate: { $lt: cutoffDate } }),
            Letter: await Letter.countDocuments({ submittedDate: { $lt: cutoffDate } }),
            cutoffDate
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Execute cleanup (archive and delete)
// @route   POST /api/cleanup/execute
// @access  Private/Admin
const executeCleanup = async (req, res) => {
    try {
        const { type, days } = req.body;
        const daysInt = parseInt(days) || 365;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInt);

        const Model = getModel(type);
        if (!Model) {
            return res.status(400).json({ message: 'Invalid request type' });
        }

        // Find records to archive
        const recordsToArchive = await Model.find({ submittedDate: { $lt: cutoffDate } });

        if (recordsToArchive.length === 0) {
            return res.json({ message: 'No records found to archive', count: 0 });
        }

        // Prepare archive documents
        const archiveDocs = recordsToArchive.map(record => ({
            originalId: record._id,
            originalCollection: type,
            data: record.toObject(),
            archivedBy: req.user._id
        }));

        // Insert into Archive
        await ArchivedRequest.insertMany(archiveDocs);

        // Delete from original collection
        const deleteResult = await Model.deleteMany({ submittedDate: { $lt: cutoffDate } });

        res.json({
            message: `Successfully archived and deleted ${deleteResult.deletedCount} ${type} records.`,
            count: deleteResult.deletedCount
        });

    } catch (error) {
        console.error("Cleanup error:", error);
        res.status(500).json({ message: 'Cleanup failed', error: error.message });
    }
};

// @desc    Get orphaned files (blobs not in DB)
// @route   GET /api/cleanup/orphaned-files
// @access  Private/Admin
const getOrphanedFiles = async (req, res) => {
    try {
        const blobs = await listBlobs();

        // Collect all file URLs from DB
        const excuseRequests = await ExcuseRequest.find({}, 'attachments');
        const letters = await Letter.find({}, 'attachments');
        const leaveRequests = await LeaveRequest.find({}, 'attachments');
        const users = await User.find({}, 'profilePicture');

        const dbUrls = new Set([
            ...excuseRequests.map(r => r.attachments).filter(Boolean),
            ...letters.map(r => r.attachments).filter(Boolean),
            ...leaveRequests.map(r => r.attachments).filter(Boolean),
            ...users.map(u => u.profilePicture).filter(Boolean)
        ]);

        const orphaned = blobs.filter(blob => !dbUrls.has(blob.url));

        res.json(orphaned);
    } catch (error) {
        console.error("Error identifying orphaned files:", error);
        res.status(500).json({ message: 'Failed to identify orphaned files', error: error.message });
    }
};

// @desc    Delete specified orphaned files
// @route   POST /api/cleanup/delete-orphaned
// @access  Private/Admin
const deleteOrphanedFiles = async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ message: 'Invalid urls provided' });
        }

        let successCount = 0;
        for (const url of urls) {
            try {
                await deleteBlob(url);
                successCount++;
            } catch (err) {
                console.error(`Failed to delete blob ${url}:`, err);
            }
        }

        res.json({ message: `Successfully deleted ${successCount} orphaned files.`, count: successCount });
    } catch (error) {
        res.status(500).json({ message: 'Deletion failed', error: error.message });
    }
};

export {
    getCleanupStats,
    executeCleanup,
    getOrphanedFiles,
    deleteOrphanedFiles
};
