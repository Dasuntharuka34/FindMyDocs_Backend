import express from 'express';
import {
    createAuditLog,
    getAuditLogs,
    exportAuditLogs,
    getAuditStats,
} from '../controllers/auditController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/log', protect, admin, createAuditLog);
router.get('/logs', protect, admin, getAuditLogs);
router.get('/export', protect, admin, exportAuditLogs);
router.get('/stats', protect, admin, getAuditStats);

export default router;
