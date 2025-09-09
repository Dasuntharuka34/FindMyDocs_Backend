import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Import all necessary controller functions
import {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  getLeaveRequestsByUserId, // Renamed and imported correctly
  approveLeaveRequest,
  rejectLeaveRequest,
  deleteLeaveRequest,
  // --- IMPORT THE NEW FUNCTION ---
  getPendingLeaveRequests
} from '../controllers/leaveRequestController.js';

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
    // Create a unique filename with a timestamp and the original file extension
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    // Allow only specific file types (images and documents)
    const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .pdf, .jpg, .jpeg, .png, .doc, .docx formats are allowed!'));
  }
});


// @desc    Submit a new leave request form with an optional file upload
// @route   POST /api/leaverequests
router.post('/', upload.single('leaveForm'), createLeaveRequest);

// @desc    Get all leave requests (for approvers)
// @route   GET /api/leaverequests
router.get('/', getLeaveRequests);

// @desc    Get all leave requests for a single user
// @route   GET /api/leaverequests/byUser/:userId
router.get('/byUser/:userId', getLeaveRequestsByUserId); // <-- This is the corrected route

// --- ADD THE NEW ROUTE HERE TO FIX THE ERROR ---
// @desc    Get all pending leave requests for a specific status
// @route   GET /api/leaverequests/pendingApprovals/:status
router.get('/pendingApprovals/:status', getPendingLeaveRequests);
// --- FIX ENDS HERE ---

// @desc    Approve a leave request
// @route   PUT /api/leaverequests/:id/approve
router.put('/:id/approve', approveLeaveRequest);

// @desc    Reject a leave request
// @route   PUT /api/leaverequests/:id/reject
router.put('/:id/reject', rejectLeaveRequest);

// @desc    Delete a leave request
// @route   DELETE /api/leaverequests/:id
router.delete('/:id', deleteLeaveRequest);

// @desc    Get a single leave request by ID
// @route   GET /api/leaverequests/:id
router.get('/:id', getLeaveRequestById);


export default router;