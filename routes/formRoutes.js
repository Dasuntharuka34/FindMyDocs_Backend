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
  getFormAnalytics,
  createNewVersion
} from '../controllers/formController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(protect, admin, getForms).post(protect, admin, createForm);

router.get('/analytics', protect, admin, getFormAnalytics);

router
  .route('/:id')
  .get(protect, getFormById)
  .put(protect, admin, updateForm)
  .delete(protect, admin, deleteForm);
router.route('/:id/status').put(protect, admin, updateFormStatus);

router.post('/:id/version', protect, admin, createNewVersion);

export default router;