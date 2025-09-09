import express from 'express';
const router = express.Router();
import {
  getPendingRegistrations,
  createRegistration,
  deleteRegistration,
} from '../controllers/registrationController.js';

router.route('/pending').get(getPendingRegistrations);
router.route('/').post(createRegistration);
router.route('/:id').delete(deleteRegistration);

export default router;
