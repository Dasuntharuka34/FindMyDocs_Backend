import express from 'express';
import {
    getEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    sendBulkEmail,
    getEmailLogs,
} from '../controllers/emailManagementController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/templates', protect, admin, getEmailTemplates);
router.post('/templates', protect, admin, createEmailTemplate);
router.put('/templates/:id', protect, admin, updateEmailTemplate);
router.delete('/templates/:id', protect, admin, deleteEmailTemplate);
router.post('/bulk-send', protect, admin, sendBulkEmail);
router.get('/logs', protect, admin, getEmailLogs);

export default router;
