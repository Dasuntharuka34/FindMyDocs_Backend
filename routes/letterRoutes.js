import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
  createLetter,
  getLetterById,
  getLettersByUserId,
  getPendingApprovals,
  updateLetterStatus,
  getAllLetters
} from '../controllers/letterController.js';

const router = express.Router();

// Configure storage for multer to handle file uploads in memory
const storage = multer.memoryStorage();

// Multer upload middleware
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
    cb(new Error('Only .pdf, .jpg, .jpeg, .png, .doc, .docx formats are allowed for attachments!'));
  }
});


// Route to get all letters (Admin only)
router.get('/', protect, admin, getAllLetters);

// Route to create a new letter
router.post('/', protect, upload.single('attachments'), createLetter);

// Route to get letters by a specific user ID
router.get('/byUser/:userId', protect, getLettersByUserId);

// Route to get pending approvals for a specific status name
router.get('/pendingApprovals/:statusName', protect, getPendingApprovals);

// Route to update letter status (Approve/Reject)
router.put('/:id/status', protect, updateLetterStatus);

// IMPORTANT: Route to get a single letter by its ID.
router.get('/:id', protect, getLetterById);

export default router;
