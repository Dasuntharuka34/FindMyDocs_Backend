import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect, admin } from '../middleware/authMiddleware.js';

// Import all necessary controller functions
import {
  approveLeaveRequest,
  createLeaveRequest,
  deleteLeaveRequest,
  getLeaveRequestById,
  getLeaveRequests,
  getLeaveRequestsByUserId,
  getPendingLeaveRequests,
  rejectLeaveRequest
} from '../controllers/leaveRequestController.js';

const router = express.Router();

// Configure storage for multer to handle file uploads in memory
const storage = multer.memoryStorage();

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


// @desc    Submit a new leave request form with an optional file upload
// @route   POST /api/leaverequests
router.route('/')
    .post(protect, upload.single('leaveForm'), createLeaveRequest)
    .get(protect, admin, getLeaveRequests); // Admin only

// @desc    Get all leave requests (for approvers)
// @route   GET /api/leaverequests
router.get('/', protect, admin, getLeaveRequests);

// @desc    Get all pending leave requests for a specific status
// @route   GET /api/leaverequests/pendingApprovals/:status
router.get('/pendingApprovals/:status', protect, getPendingLeaveRequests);

// @desc    Approve a leave request
// @route   PUT /api/leaverequests/:id/approve
router.put('/:id/approve', protect, approveLeaveRequest);

// @desc    Reject a leave request
// @route   PUT /api/leaverequests/:id/reject
router.put('/:id/reject', protect, rejectLeaveRequest);

router.route('/:id')
    .get(protect, getLeaveRequestById)
    .delete(protect, admin, deleteLeaveRequest); // Admin only

// @desc    Get all leave requests for a specific user
// @route   GET /api/leaverequests/byUser/:userId
router.get('/byUser/:userId', protect, getLeaveRequestsByUserId);




export default router;