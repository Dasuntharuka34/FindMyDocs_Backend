import express from 'express';
import {
    bulkImportUsers,
    bulkResetPasswords,
    bulkUpdateRoles,
    bulkDeleteUsers,
    getUserActivityHistory,
    toggleUserStatus,
    searchUsers,
} from '../controllers/userEnhancementController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/bulk-import', protect, admin, bulkImportUsers);
router.post('/bulk-reset-password', protect, admin, bulkResetPasswords);
router.post('/bulk-update-roles', protect, admin, bulkUpdateRoles);
router.post('/bulk-delete', protect, admin, bulkDeleteUsers);
router.get('/:id/activity', protect, admin, getUserActivityHistory);
router.put('/:id/toggle-status', protect, admin, toggleUserStatus);
router.post('/search', protect, admin, searchUsers);

export default router;
