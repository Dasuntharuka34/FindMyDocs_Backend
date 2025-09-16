import express from 'express';
import multer from 'multer'; // Import multer
import path from 'path'; // Node.js path module
import { protect, admin } from '../utils/authMiddleware.js';

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .jpeg, .jpg, .png image formats are allowed!'));
  }
});

// Import controllers
import {
  approveRegistration,
  authUser,
  changePassword,
  createUser,
  deleteUser,
  getAllPendingRequests,
  getPendingRegistrations,
  getUsers,
  registerUser,
  rejectRegistration,
  resetUserPassword,
  updateUser
} from '../controllers/userController.js';

// --- Public Routes ---
router.post('/register', registerUser);
router.post('/login', authUser);

// --- Admin User Management Routes ---
router.get('/', protect, admin, getUsers);
router.post('/', protect, admin, createUser); // Manual user creation by admin

// --- User Profile Update Route with Multer ---
// This route now expects a 'profilePicture' file field
// The path in userController.js should match the URL served by server.js
router.put('/:id', protect, upload.single('profilePicture'), updateUser); // Apply multer here

router.delete('/:id', protect, admin, deleteUser);

// Route to reset a user's password to a default value
router.put('/:id/reset-password', protect, admin, resetUserPassword); // <-- New route for password reset

// Route to allow a user to change their own password
router.put('/:id/change-password', protect, changePassword); // <-- New route for user password change

// --- Admin Registration Approval Routes ---
router.get('/registrations/pending', protect, admin, getPendingRegistrations);
router.post('/registrations/:id/approve', protect, admin, approveRegistration);
router.delete('/registrations/:id/reject', protect, admin, rejectRegistration);

// --- Admin Pending Requests Route ---
router.get('/pendingRequests', protect, admin, getAllPendingRequests);

export default router;
