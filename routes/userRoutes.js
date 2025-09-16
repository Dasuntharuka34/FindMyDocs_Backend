import express from 'express';
import multer from 'multer'; // Import multer
import path from 'path'; // Node.js path module

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
router.get('/', getUsers);
router.post('/', createUser); // Manual user creation by admin

// --- User Profile Update Route with Multer ---
// This route now expects a 'profilePicture' file field
// The path in userController.js should match the URL served by server.js
router.put('/:id', upload.single('profilePicture'), updateUser); // Apply multer here

router.delete('/:id', deleteUser);

// Route to reset a user's password to a default value
router.put('/:id/reset-password', resetUserPassword); // <-- New route for password reset

// Route to allow a user to change their own password
router.put('/:id/change-password', changePassword); // <-- New route for user password change

// --- Admin Registration Approval Routes ---
router.get('/registrations/pending', getPendingRegistrations);
router.post('/registrations/:id/approve', approveRegistration);
router.delete('/registrations/:id/reject', rejectRegistration);

// --- Admin Pending Requests Route ---
router.get('/pendingRequests', getAllPendingRequests);

export default router;
