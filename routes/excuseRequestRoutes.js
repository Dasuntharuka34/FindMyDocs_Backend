import express from 'express';
import multer from 'multer';
import path from 'path';

import {
  approveExcuseRequest,
  createExcuseRequest,
  deleteExcuseRequest,
  getExcuseRequestById,
  getExcuseRequests,
  getExcuseRequestsByUserId,
  getPendingExcuseApprovals,
  rejectExcuseRequest
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
router.get('/byUser/:userId', getExcuseRequestsByUserId);

// @desc    Approve a excuse request
// @route   PUT /api/excuserequests/:id/approve
router.put('/:id/approve', approveExcuseRequest);

// @desc    Reject a excuse request
// @route   PUT /api/excuserequests/:id/reject
router.put('/:id/reject', rejectExcuseRequest);

// @desc    Delete a excuse request
// @route   DELETE /api/excuserequests/:id
router.delete('/:id', deleteExcuseRequest);

// @desc    Get a single excuse request by ID
// @route   GET /api/excuserequests/:id
router.get('/:id', getExcuseRequestById);


router.get('/pendingApprovals/:statusName', getPendingExcuseApprovals);


export default router;
