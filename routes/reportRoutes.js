import express from 'express';
const router = express.Router();
import { generateReport } from '../controllers/reportController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// @route   POST /api/reports/generate
// @desc    Generate a report
// @access  Private/Admin
router.post('/generate', protect, admin, generateReport);
router.post('/custom', protect, admin, getCustomReport);
router.post('/scheduled', protect, admin, createScheduledReport);
router.get('/scheduled', protect, admin, getScheduledReports);
router.delete('/scheduled/:id', protect, admin, deleteScheduledReport);

export default router;
