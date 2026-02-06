import express from 'express';
import multer from 'multer';
import {
    downloadBackup,
    restoreDatabase,
    getDatabaseStats
} from '../controllers/databaseController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Memory storage for file upload (we process it immediately)
const upload = multer({ storage: multer.memoryStorage() });

router.get('/backup', protect, admin, downloadBackup);
router.get('/stats', protect, admin, getDatabaseStats);
router.post('/restore', protect, admin, upload.single('backupFile'), restoreDatabase);

export default router;
