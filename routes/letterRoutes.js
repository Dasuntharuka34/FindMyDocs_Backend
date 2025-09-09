import express from 'express';
import multer from 'multer'; // multer import කරන්න
import path from 'path'; // path module import කරන්න
import fs from 'fs'; // fs (file system) module import කරන්න

const router = express.Router();
import {
  createLetter,
  getLettersByUserId,
  updateLetterStatus,
  getPendingApprovals,
  getLetterById
} from '../controllers/letterController.js';

const uploadsDir = 'uploads/attachments/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer storage configuration for letter attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

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


// Route to create a new letter
router.post('/', upload.single('attachments'), createLetter);

// Route to get letters by a specific user ID
router.get('/byUser/:userId', getLettersByUserId);

// Route to get pending approvals for a specific status name
router.get('/pendingApprovals/:statusName', getPendingApprovals);

// Route to update letter status (Approve/Reject)
router.put('/:id/status', updateLetterStatus);

// IMPORTANT: Route to get a single letter by its ID.
router.get('/:id', getLetterById);

export default router;
