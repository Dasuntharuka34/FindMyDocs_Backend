import express from 'express';
const router = express.Router();
import {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  updateFormStatus,
  getAvailableForms,
} from '../controllers/formController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(protect, admin, getForms).post(protect, admin, createForm);
router.route('/available').get(protect, getAvailableForms);
router
  .route('/:id')
  .get(protect, getFormById)
  .put(protect, admin, updateForm)
  .delete(protect, admin, deleteForm);
router.route('/:id/status').put(protect, admin, updateFormStatus);

router.get('/analytics', protect, admin, getFormAnalytics);
router.post('/:id/version', protect, admin, createNewVersion);

export default router;