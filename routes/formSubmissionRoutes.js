
import express from 'express';
import multer from 'multer';
import {
  createSubmission,
  getSubmissions,
  getPendingSubmissions,
  getMySubmissions,
  updateSubmissionStatus,
  getSubmissionById,
  bulkApproveSubmissions,
  bulkRejectSubmissions
} from '../controllers/formSubmissionController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.route('/').post(protect, upload.any(), createSubmission).get(protect, admin, getSubmissions);
router.route('/pending').get(protect, getPendingSubmissions);
router.route('/my-submissions').get(protect, getMySubmissions);
router.route('/bulk-approve').post(protect, bulkApproveSubmissions);
router.route('/bulk-reject').post(protect, bulkRejectSubmissions);
router.route('/:id').get(protect, getSubmissionById);
router.route('/:id/status').put(protect, updateSubmissionStatus);

export default router;