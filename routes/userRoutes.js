import express from 'express';
import fs from 'fs'; // Node.js file system module
import multer from 'multer'; // Import multer
import path from 'path'; // Node.js path module
import { fileURLToPath } from 'url'; // For ES Modules to get __dirname

const router = express.Router();

// Get __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the absolute path to the uploads directory for profile pictures
// This will resolve to your_backend_root/uploads/profile_pictures
const profileUploadsDir = path.join(__dirname, '..', 'uploads', 'profile_pictures');

// Ensure the directory exists (skip in Vercel serverless environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  try {
    if (!fs.existsSync(profileUploadsDir)) {
      fs.mkdirSync(profileUploadsDir, { recursive: true });
      console.log(`Created uploads directory at: ${profileUploadsDir}`);
    }
  } catch (error) {
    console.log(`Could not create uploads directory: ${error.message}`);
  }
}

// Configure multer storage based on environment
let storage;
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  // Use memory storage in Vercel serverless environment
  storage = multer.memoryStorage();
} else {
  // Use disk storage in development/local environment
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, profileUploadsDir); // Use the robustly defined absolute path
    },
    filename: (req, file, cb) => {
      // Use user ID or a unique ID to name the profile picture
      // For simplicity, using Date.now(). In a real app, use req.user._id if authenticated
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    },
  });
}

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
