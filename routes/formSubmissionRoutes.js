
import express from 'express';
import {
  createSubmission,
  getSubmissions,
  getPendingSubmissions,
  getMySubmissions,
  updateSubmissionStatus,
} from '../controllers/formSubmissionController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, createSubmission).get(protect, admin, getSubmissions);
router.route('/pending').get(protect, admin, getPendingSubmissions);
router.route('/my-submissions').get(protect, getMySubmissions);
router.route('/:id/status').put(protect, admin, updateSubmissionStatus);

export default router;
