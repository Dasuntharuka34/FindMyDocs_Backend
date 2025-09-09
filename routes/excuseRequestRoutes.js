import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import {
  createExcuseRequest,
  getExcuseRequests,
  getExcuseRequestById,
  getExcuseRequestsByUserId,
  approveExcuseRequest,
  rejectExcuseRequest,
  deleteExcuseRequest,
  getPendingExcuseApprovals
} from '../controllers/excuseRequestController.js';

const router = express.Router();

// Ensure the 'uploads' directory exists
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure storage for multer to handle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .pdf, .jpg, .jpeg, .png, .doc, .docx formats are allowed!'));
  }
});

// @desc    Submit a new excuse request form with an optional file upload
// @route   POST /api/excuserequests
router.post('/', upload.single('medicalForm'), createExcuseRequest);

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