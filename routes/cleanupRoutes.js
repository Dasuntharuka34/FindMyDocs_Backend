import express from 'express';
import {
    getCleanupStats,
    executeCleanup
} from '../controllers/cleanupController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, admin, getCleanupStats);
router.post('/execute', protect, admin, executeCleanup);
router.get('/orphaned-files', protect, admin, getOrphanedFiles);
router.post('/delete-orphaned', protect, admin, deleteOrphanedFiles);

export default router;
