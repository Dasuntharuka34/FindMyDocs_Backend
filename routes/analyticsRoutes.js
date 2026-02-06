import express from 'express';
import {
    getActivityDashboard,
    getSystemHealth,
    getUsageStatistics,
    getRequestAnalytics,
} from '../controllers/analyticsController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/activity', protect, admin, getActivityDashboard);
router.get('/system-health', protect, admin, getSystemHealth);
router.get('/usage', protect, admin, getUsageStatistics);
router.get('/requests', protect, admin, getRequestAnalytics);

export default router;
