import express from 'express';
import multer from 'multer'; // Import multer
import path from 'path'; // Node.js path module
import { fileURLToPath } from 'url'; // For ES Modules to get __dirname
import { protect, admin } from '../middleware/authMiddleware.js';

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

const csvUpload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed!'), false);
    }
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
  updateUser,
  bulkImportUsers,
  bulkDeleteUsers,
  bulkResetPasswords,
  bulkUpdateRoles,
  getUserActivityHistory,
  toggleUserStatus,
  searchUsers
} from '../controllers/userController.js';

// --- Public Routes ---
router.post('/register', registerUser);
router.post('/login', authUser);

// --- Admin User Management Routes ---
router.route('/').get(protect, admin, getUsers).post(protect, admin, createUser);

// --- User Profile Update Route with Multer ---
// This route now expects a 'profilePicture' file field
// The path in userController.js should match the URL served by server.js
router.route('/:id')
  .put(protect, upload.single('profilePicture'), updateUser) // User should be protected to update their own profile
  .delete(protect, admin, deleteUser); // Admin only to delete

// Route to reset a user's password to a default value
router.put('/:id/reset-password', protect, admin, resetUserPassword);

// Route to allow a user to change their own password
router.put('/:id/change-password', protect, changePassword);

// --- Admin Registration Approval Routes ---
router.get('/registrations/pending', protect, admin, getPendingRegistrations);
router.post('/registrations/:id/approve', protect, admin, approveRegistration);
router.delete('/registrations/:id/reject', protect, admin, rejectRegistration);


// --- Admin Bulk User Management Routes ---
router.post('/bulk-import', protect, admin, csvUpload.single('file'), bulkImportUsers);
router.post('/bulk-delete', protect, admin, bulkDeleteUsers);
router.post('/bulk-reset-password', protect, admin, bulkResetPasswords);
router.post('/bulk-update-roles', protect, admin, bulkUpdateRoles);
router.post('/search', protect, admin, searchUsers);

// --- User Activity & Status ---
router.get('/:id/activity', protect, admin, getUserActivityHistory);
router.put('/:id/toggle-status', protect, admin, toggleUserStatus);

// --- Admin Pending Requests Route ---
router.get('/pendingRequests', protect, admin, getAllPendingRequests);

export default router;