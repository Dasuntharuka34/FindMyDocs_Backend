import express from 'express';
import {
    createRegistration,
    deleteRegistration,
    getPendingRegistrations,
    verifyEmail,
} from '../controllers/registrationController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
const router = express.Router();

router.route('/pending').get(protect, admin, getPendingRegistrations);
router.route('/').post(createRegistration);
router.route('/:id').delete(protect, admin, deleteRegistration);
router.route('/verify/:token').get(verifyEmail);

export default router;
