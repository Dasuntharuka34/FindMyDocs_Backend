import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect, admin } from '../middleware/authMiddleware.js';

import {
  approveExcuseRequest,
  createExcuseRequest,
  deleteExcuseRequest,
  getExcuseRequestById,
  getExcuseRequests,
  getExcuseRequestsByUserId,
  getPendingExcuseApprovals,
  rejectExcuseRequest,
  bulkApproveExcuseRequests,
  bulkRejectExcuseRequests
} from '../controllers/excuseRequestController.js';

const router = express.Router();

// Configure multer for handling file uploads using memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and PDF files are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB file size limit
  },
  fileFilter: fileFilter
});

// @desc    Submit a new excuse request form with an optional file upload
// @route   POST /api/excuserequests
router.post('/', upload.single('medicalCertificate'), createExcuseRequest);

// @desc    Get all excuse requests (for approvers)
// @route   GET /api/excuserequests
router.get('/', getExcuseRequests);

// @desc    Get all excuse requests for a single user
// @route   GET /api/excuserequests/byUser/:userId
router.get('/byUser/:userId', protect, getExcuseRequestsByUserId);

// @desc    Approve a excuse request
// @route   PUT /api/excuserequests/:id/approve
router.put('/:id/approve', protect, approveExcuseRequest);

// @desc    Reject a excuse request
// @route   PUT /api/excuserequests/:id/reject
router.put('/:id/reject', protect, rejectExcuseRequest);

// @desc    Get a single excuse request by ID
// @route   GET /api/excuserequests/:id
router.route('/:id')
  .get(protect, getExcuseRequestById)
  .delete(protect, admin, deleteExcuseRequest); // Admin only


router.get('/pendingApprovals', protect, getPendingExcuseApprovals);

// @desc    Bulk Approve Excuse Requests
// @route   POST /api/excuserequests/bulk-approve
router.post('/bulk-approve', protect, bulkApproveExcuseRequests);

// @desc    Bulk Reject Excuse Requests
// @route   POST /api/excuserequests/bulk-reject
router.post('/bulk-reject', protect, bulkRejectExcuseRequests);


export default router;