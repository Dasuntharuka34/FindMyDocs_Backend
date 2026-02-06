import express from 'express';
import {
    getErrorLogs,
    clearErrorLogs,
    runQuery,
    getSystemStats,
    getApiDocs,
    clearCache
} from '../controllers/developerController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/error-logs', protect, admin, getErrorLogs);
router.delete('/error-logs', protect, admin, clearErrorLogs);
router.post('/query', protect, admin, runQuery);
router.get('/system-stats', protect, admin, getSystemStats);
router.get('/docs', protect, admin, getApiDocs);
router.post('/clear-cache', protect, admin, clearCache);

export default router;
