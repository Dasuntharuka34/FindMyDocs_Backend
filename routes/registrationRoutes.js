import express from 'express';
import {
    createRegistration,
    deleteRegistration,
    getPendingRegistrations,
} from '../controllers/registrationController.js';
const router = express.Router();

router.route('/pending').get(getPendingRegistrations);
router.route('/').post(createRegistration);
router.route('/:id').delete(deleteRegistration);

export default router;
