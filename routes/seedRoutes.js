
import express from 'express';
import { seedForms } from '../controllers/seedController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, seedForms);

export default router;
