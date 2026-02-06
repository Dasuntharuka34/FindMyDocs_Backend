import express from 'express';
import {
    getSecurityLogs,
    getActiveSessions,
    terminateSession,
    getPermissionAudit,
    exportUserData,
    anonymizeUserData,
} from '../controllers/securityController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/logs', protect, admin, getSecurityLogs);
router.get('/sessions', protect, admin, getActiveSessions);
router.delete('/sessions/:id', protect, admin, terminateSession);
router.get('/permissions-audit', protect, admin, getPermissionAudit);
router.get('/export-user-data/:userId', protect, admin, exportUserData);
router.post('/anonymize-user/:userId', protect, admin, anonymizeUserData);

export default router;
