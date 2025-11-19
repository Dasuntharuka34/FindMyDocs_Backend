import express from 'express';
const router = express.Router();
import { generateReport } from '../controllers/reportController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// @route   POST /api/reports/generate
// @desc    Generate a report
// @access  Private/Admin
router.post('/generate', protect, admin, generateReport);

export default router;
