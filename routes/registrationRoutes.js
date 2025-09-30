import express from 'express';
import {
    createRegistration,
    deleteRegistration,
    getPendingRegistrations,
} from '../controllers/registrationController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
const router = express.Router();

router.route('/pending').get(protect, admin, getPendingRegistrations);
router.route('/').post(createRegistration);
router.route('/:id').delete(protect, admin, deleteRegistration);

export default router;
